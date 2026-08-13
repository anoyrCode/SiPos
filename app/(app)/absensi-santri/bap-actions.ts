"use server";

import { createClient } from "@/lib/supabase/server";
import { canAbsensiSantri, canRekapAbsensiSantri } from "@/lib/auth/dal";
import {
  hitungBap,
  type BapData,
  type BapPengecualianRow,
} from "@/lib/bap-absensi-santri";

export type BapResult =
  | {
      ok: true;
      data: BapData;
      catatan: { jam: string; isi: string }[];
      jamPengecekan: string[];
    }
  | { ok: false; error: string };

export async function getBapData(
  kelasId: string,
  shift: number,
  tanggal: string,
): Promise<BapResult> {
  const [bolehInput, bolehRekap] = await Promise.all([
    canAbsensiSantri(),
    canRekapAbsensiSantri(),
  ]);
  if (!bolehInput && !bolehRekap) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();

  const { data: cpData } = await supabase
    .from("absensi_santri_checkpoint")
    .select("id, jam, urutan")
    .eq("shift", shift)
    .order("urutan");
  const checkpoints = (cpData ?? []) as { id: string; jam: string; urutan: number }[];
  if (checkpoints.length === 0) {
    return { ok: false, error: "Jadwal checkpoint tidak ditemukan." };
  }
  const checkpointIds = checkpoints.map((c) => c.id);
  const urutanById = new Map(checkpoints.map((c) => [c.id, c.urutan]));
  const jamById = new Map(checkpoints.map((c) => [c.id, c.jam]));

  const [
    { count: rosterCount },
    { data: submisiData },
    { data: pengecualianData },
    { data: catatanData },
  ] = await Promise.all([
    supabase
      .from("santri_kelas")
      .select("santri_id", { count: "exact", head: true })
      .eq("kelas_id", kelasId),
    supabase
      .from("absensi_santri_submission")
      .select("checkpoint_id")
      .eq("kelas_id", kelasId)
      .eq("tanggal", tanggal)
      .in("checkpoint_id", checkpointIds),
    supabase
      .from("absensi_santri")
      .select("santri_id, status, catatan, checkpoint_id, santri:santri(nama, nis)")
      .eq("kelas_id", kelasId)
      .eq("tanggal", tanggal)
      .in("checkpoint_id", checkpointIds),
    supabase
      .from("absensi_santri_catatan")
      .select("jam, isi")
      .eq("kelas_id", kelasId)
      .eq("tanggal", tanggal)
      .eq("shift", shift)
      .order("jam"),
  ]);

  // Gerbang kelengkapan divalidasi ULANG di sini — tombol yang mati di layar
  // hanya kenyamanan, server action bisa dipanggil langsung.
  const terisi = new Set((submisiData ?? []).map((s) => s.checkpoint_id as string));
  const kurang = checkpoints.filter((c) => !terisi.has(c.id));
  if (kurang.length > 0) {
    return {
      ok: false,
      error: `Belum semua jam pengecekan diisi: ${kurang
        .map((c) => c.jam.slice(0, 5))
        .join(", ")}.`,
    };
  }

  const rows: BapPengecualianRow[] = (
    (pengecualianData ?? []) as unknown as {
      santri_id: string;
      status: "izin" | "sakit" | "alpa";
      catatan: string | null;
      checkpoint_id: string;
      santri: { nama: string; nis: string | null } | null;
    }[]
  ).map((r) => ({
    santri_id: r.santri_id,
    nama: r.santri?.nama ?? "—",
    nis: r.santri?.nis ?? null,
    status: r.status,
    jam: jamById.get(r.checkpoint_id) ?? "00:00:00",
    urutan: urutanById.get(r.checkpoint_id) ?? 0,
    catatan: r.catatan,
  }));

  return {
    ok: true,
    data: hitungBap(rosterCount ?? 0, rows),
    catatan: ((catatanData ?? []) as { jam: string; isi: string }[]).map((c) => ({
      jam: c.jam,
      isi: c.isi,
    })),
    jamPengecekan: checkpoints.map((c) => c.jam.slice(0, 5)),
  };
}
