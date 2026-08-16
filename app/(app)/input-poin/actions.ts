"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { dbErrorMessage } from "@/lib/forms";
import {
  inputPoinSchema,
  type InputPoinValues,
  type KelasOpt,
  type SantriHit,
} from "./schema";

type SaveResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

async function staffProfile() {
  const p = await getProfile();
  if (!p || !p.perms.input_poin) return null;
  return p;
}

/**
 * Kelas yang boleh disentuh pemanggil pada tahun ajaran aktif.
 *
 * `null` berarti TIDAK dibatasi (peran super atau tanpa `scope_kelas`) —
 * berbeda dari `[]` yang berarti dibatasi tapi tidak kebagian kelas apa pun.
 * Membedakan keduanya penting: `[]` harus menghasilkan nol hasil, sedangkan
 * `null` harus menghasilkan semua.
 *
 * Satu-satunya sumber kebenaran pembatasan ini. Dipakai bersama oleh
 * pencarian santri dan pemilih per-kelas — kalau logikanya disalin, cepat
 * atau lambat keduanya berbeda dan salah satunya membocorkan santri yang
 * bukan tanggung jawab musyrif ybs.
 */
async function kelasTerjangkauIds(
  profile: NonNullable<Awaited<ReturnType<typeof staffProfile>>>,
  taId: string | null,
): Promise<string[] | null> {
  if (!profile.perms.scope_kelas || profile.perms.super) return null;
  if (!taId || !profile.pegawai_id) return [];

  const supabase = await createClient();
  const { data: gk } = await supabase
    .from("guru_kelas")
    .select("kelas_id, kelas:kelas!inner(tahun_ajaran_id)")
    .eq("pegawai_id", profile.pegawai_id)
    .eq("kelas.tahun_ajaran_id", taId);
  return ((gk ?? []) as unknown as { kelas_id: string }[]).map((r) => r.kelas_id);
}

/** Santri yang boleh disentuh pemanggil. `null` = tidak dibatasi. */
async function santriTerjangkauIds(
  profile: NonNullable<Awaited<ReturnType<typeof staffProfile>>>,
  taId: string | null,
): Promise<string[] | null> {
  const kelasIds = await kelasTerjangkauIds(profile, taId);
  if (kelasIds === null) return null;
  if (kelasIds.length === 0) return [];

  const supabase = await createClient();
  const { data: sk } = await supabase
    .from("santri_kelas")
    .select("santri_id")
    .in("kelas_id", kelasIds);
  return [
    ...new Set(((sk ?? []) as { santri_id: string }[]).map((r) => r.santri_id)),
  ];
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

  const allowedIds = await santriTerjangkauIds(profile, ta?.id ?? null);
  if (allowedIds !== null && allowedIds.length === 0) return [];

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

/**
 * Kelas yang boleh dipilih pemanggil pada tahun ajaran aktif.
 *
 * Berbeda dari `getScopedSantri()` yang mengambil SELURUH santri lintas
 * semua kelas yang diampu sekaligus — untuk musyrif shift 3 yang mengampu
 * puluhan kelas, itu ratusan santri dalam satu tarikan dan tidak mungkin
 * ditinjau. Dua action ini memberi butiran per-kelas.
 */
export async function getKelasTerjangkau(): Promise<KelasOpt[]> {
  const profile = await staffProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return [];

  const izin = await kelasTerjangkauIds(profile, ta.id);
  if (izin !== null && izin.length === 0) return [];

  let q = supabase
    .from("kelas")
    .select("id, nama_kelas")
    .eq("tahun_ajaran_id", ta.id);
  if (izin) q = q.in("id", izin);
  const { data } = await q;

  // Diurutkan di sini (bukan di database) dengan `numeric: true` supaya
  // "Kelas 7A" tampil sebelum "Kelas 10A" — urutan leksikografis database
  // menaruh "10" sebelum "7".
  return ((data ?? []) as KelasOpt[]).sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }),
  );
}

/** Santri aktif di satu kelas, untuk pemilih "centang per kelas". */
export async function getSantriByKelas(kelasId: string): Promise<SantriHit[]> {
  const profile = await staffProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return [];

  // `kelasId` datang dari klien. Tanpa gerbang ini, peran ter-scope bisa
  // menarik roster kelas mana pun lalu memberi poin ke santri yang bukan
  // tanggung jawabnya.
  const izin = await kelasTerjangkauIds(profile, ta.id);
  if (izin !== null && !izin.includes(kelasId)) return [];

  const { data: kelasRow } = await supabase
    .from("kelas")
    .select("nama_kelas")
    .eq("id", kelasId)
    .eq("tahun_ajaran_id", ta.id)
    .maybeSingle();
  if (!kelasRow) return [];

  const { data: sk } = await supabase
    .from("santri_kelas")
    .select("santri:santri!inner(id, nis, nama, status)")
    .eq("kelas_id", kelasId);

  const hits: SantriHit[] = [];
  for (const r of (sk ?? []) as unknown as {
    santri: { id: string; nis: string | null; nama: string; status: string } | null;
  }[]) {
    const s = r.santri;
    if (!s || s.status !== "aktif") continue;
    hits.push({
      id: s.id,
      nis: s.nis,
      nama: s.nama,
      kelas: kelasRow.nama_kelas,
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
