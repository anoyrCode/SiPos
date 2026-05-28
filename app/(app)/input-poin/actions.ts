"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { dbErrorMessage } from "@/lib/forms";
import { inputPoinSchema, type InputPoinValues, type SantriHit } from "./schema";

type SaveResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

async function staffProfile() {
  const p = await getProfile();
  if (!p || !p.perms.input_poin) return null;
  return p;
}

/** Cari santri aktif (NIS/nama) + kelas di tahun ajaran aktif. */
export async function searchSantri(term: string): Promise<SantriHit[]> {
  const profile = await staffProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  // Peran ter-scope: batasi ke santri di kelas yang ditugaskan (TA aktif).
  let allowedIds: string[] | null = null;
  if (profile.perms.scope_kelas && !profile.perms.super) {
    if (!ta?.id || !profile.pegawai_id) return [];
    const { data: gk } = await supabase
      .from("guru_kelas")
      .select("kelas_id, kelas:kelas!inner(tahun_ajaran_id)")
      .eq("pegawai_id", profile.pegawai_id)
      .eq("kelas.tahun_ajaran_id", ta.id);
    const kelasIds = ((gk ?? []) as unknown as { kelas_id: string }[]).map(
      (r) => r.kelas_id,
    );
    if (kelasIds.length === 0) return [];
    const { data: sk } = await supabase
      .from("santri_kelas")
      .select("santri_id")
      .in("kelas_id", kelasIds);
    allowedIds = [
      ...new Set(
        ((sk ?? []) as { santri_id: string }[]).map((r) => r.santri_id),
      ),
    ];
    if (allowedIds.length === 0) return [];
  }

  let query = supabase
    .from("santri")
    .select("id, nis, nama")
    .eq("status", "aktif")
    .order("nama")
    .limit(20);
  if (allowedIds) query = query.in("id", allowedIds);
  const t = term.replace(/[,()*]/g, " ").trim();
  if (t) query = query.or(`nama.ilike.*${t}*,nis.ilike.*${t}*`);
  const { data: santri } = await query;
  const list = santri ?? [];

  const kelasMap = new Map<string, string>();
  if (ta?.id && list.length > 0) {
    const ids = list.map((s) => s.id);
    const { data: sk } = await supabase
      .from("santri_kelas")
      .select("santri_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
      .in("santri_id", ids)
      .eq("kelas.tahun_ajaran_id", ta.id);
    for (const r of (sk ?? []) as unknown as {
      santri_id: string;
      kelas: { nama_kelas: string } | null;
    }[]) {
      if (r.kelas?.nama_kelas) kelasMap.set(r.santri_id, r.kelas.nama_kelas);
    }
  }

  return list.map((s) => ({
    id: s.id,
    nis: s.nis,
    nama: s.nama,
    kelas: kelasMap.get(s.id) ?? null,
  }));
}

/**
 * Semua santri aktif di kelas yang ditugaskan ke user (TA aktif).
 * Hanya untuk peran ter-scope (guru/musyrif) — untuk tombol "pilih semua".
 */
export async function getScopedSantri(): Promise<SantriHit[]> {
  const profile = await staffProfile();
  if (!profile || !profile.perms.scope_kelas || !profile.pegawai_id) return [];

  const supabase = await createClient();
  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return [];

  const { data: gk } = await supabase
    .from("guru_kelas")
    .select("kelas_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("kelas.tahun_ajaran_id", ta.id);
  const kelasRows = (gk ?? []) as unknown as {
    kelas_id: string;
    kelas: { nama_kelas: string } | null;
  }[];
  if (kelasRows.length === 0) return [];
  const kelasNama = new Map(
    kelasRows.map((r) => [r.kelas_id, r.kelas?.nama_kelas ?? null]),
  );

  const { data: sk } = await supabase
    .from("santri_kelas")
    .select("kelas_id, santri:santri!inner(id, nis, nama, status)")
    .in(
      "kelas_id",
      kelasRows.map((r) => r.kelas_id),
    );
  const rows = (sk ?? []) as unknown as {
    kelas_id: string;
    santri: { id: string; nis: string | null; nama: string; status: string } | null;
  }[];

  const seen = new Set<string>();
  const hits: SantriHit[] = [];
  for (const r of rows) {
    const s = r.santri;
    if (!s || s.status !== "aktif" || seen.has(s.id)) continue;
    seen.add(s.id);
    hits.push({
      id: s.id,
      nis: s.nis,
      nama: s.nama,
      kelas: kelasNama.get(r.kelas_id) ?? null,
    });
  }
  hits.sort((a, b) => a.nama.localeCompare(b.nama));
  return hits;
}

/** Catat transaksi poin (mendukung batch beberapa santri). */
export async function createTransaksi(
  input: InputPoinValues,
): Promise<SaveResult> {
  const profile = await staffProfile();
  if (!profile) return { ok: false, error: "Tidak diizinkan." };

  const parsed = inputPoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const v = parsed.data;

  const supabase = await createClient();

  const { data: poinRows } = await supabase
    .from("master_poin")
    .select("id, tipe, nilai_poin, is_aktif")
    .in("id", v.master_poin_ids);
  const poins = (poinRows ?? []).filter((p) => p.is_aktif);
  if (poins.length === 0 || poins.length !== v.master_poin_ids.length) {
    return { ok: false, error: "Sebagian poin tidak ditemukan atau nonaktif." };
  }

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  // Override hanya boleh admin & hanya saat tepat satu poin dipilih.
  const singleOverride = profile.perms.super && v.is_override && poins.length === 1;

  // Tiap santri × tiap poin = satu transaksi.
  const rows = v.santri_ids.flatMap((santri_id) =>
    poins.map((poin) => {
      const nilai = singleOverride ? v.nilai_poin : poin.nilai_poin;
      return {
        santri_id,
        master_poin_id: poin.id,
        pegawai_id: profile.pegawai_id ?? null,
        tipe: poin.tipe,
        nilai_poin: nilai,
        is_override: singleOverride && nilai !== poin.nilai_poin,
        tanggal_kejadian: v.tanggal_kejadian,
        catatan: v.catatan || null,
        tahun_ajaran_id: ta.id,
      };
    }),
  );

  const { data, error } = await supabase
    .from("transaksi_poin")
    .insert(rows)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/riwayat-poin");
  revalidatePath("/input-poin");
  return { ok: true, inserted: data?.length ?? rows.length };
}
