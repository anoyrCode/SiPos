"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAbsensiSantri, getProfile } from "@/lib/auth/dal";
import { todayJakarta, nowHHMMJakarta } from "@/lib/absensi-status";
import { tanggalShift } from "@/lib/absensi-santri";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

type Pengecualian = {
  santri_id: string;
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
};

export async function submitAbsensiSantri(
  kelasId: string,
  checkpointId: string,
  tanggal: string,
  pengecualian: Pengecualian[],
): Promise<FormResult> {
  if (!(await canAbsensiSantri())) {
    return { ok: false, error: "Tidak diizinkan." };
  }
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak terhubung ke data pegawai." };
  }

  const supabase = await createClient();

  // `tanggal` dikirim dari klien, dan action ini bisa dipanggil langsung
  // tanpa lewat UI (server action biasa, bukan cuma dari form) — hitung
  // ulang tanggal yang SEHARUSNYA berlaku untuk checkpoint ini (rumus sama
  // seperti tanggalShift() yang dipakai halaman) dan tolak kalau tidak
  // cocok, supaya klien tidak bisa menimpa/menghapus riwayat tanggal
  // sembarang (mis. tanggal jauh di masa lalu).
  const { data: checkpointRow } = await supabase
    .from("absensi_santri_checkpoint")
    .select("shift")
    .eq("id", checkpointId)
    .maybeSingle();
  if (!checkpointRow) {
    return { ok: false, error: "Checkpoint tidak ditemukan." };
  }
  const { data: shiftCheckpoints } = await supabase
    .from("absensi_santri_checkpoint")
    .select("jam")
    .eq("shift", checkpointRow.shift)
    .order("urutan");
  if (!shiftCheckpoints || shiftCheckpoints.length === 0) {
    return { ok: false, error: "Jadwal checkpoint tidak ditemukan." };
  }
  const expectedTanggal = tanggalShift(shiftCheckpoints, nowHHMMJakarta(), todayJakarta());
  // Toleransi 1 hari, bukan cocok persis — `tanggal` yang dikirim klien
  // dihitung SAAT HALAMAN DIMUAT, sedangkan `expectedTanggal` dihitung
  // ulang SAAT SUBMIT. Kalau musyrif membuka halaman beberapa menit sebelum
  // jam mulai shift (mis. 20:55 utk shift 3) lalu baru submit setelah jam
  // 21:00 lewat, kedua momen itu jatuh di sisi berlawanan dari batas
  // shift — bukan penyalahgunaan, cuma jeda wajar mengisi form. Toleransi
  // ini tetap menolak tanggal yang jauh (mis. berminggu-minggu lalu), yang
  // itu skenario yang sebenarnya ingin dicegah.
  const bedaHari = Math.round(
    Math.abs(
      Date.parse(`${tanggal}T00:00:00Z`) - Date.parse(`${expectedTanggal}T00:00:00Z`),
    ) / 86_400_000,
  );
  if (Number.isNaN(bedaHari) || bedaHari > 1) {
    return {
      ok: false,
      error: "Tanggal tidak sesuai jam saat ini. Muat ulang halaman dan coba lagi.",
    };
  }

  // RLS `absensi_santri_insert` hanya memvalidasi kelas + checkpoint, TIDAK
  // memeriksa apakah santri_id-nya memang anggota kelas tsb — tanpa cek ini
  // request yang dimodifikasi bisa menyelipkan santri dari kelas lain ke
  // absensi kelas ini (walinya akan melihat catatan palsu).
  if (pengecualian.length > 0) {
    const { data: anggota } = await supabase
      .from("santri_kelas")
      .select("santri_id")
      .eq("kelas_id", kelasId);
    const anggotaSet = new Set((anggota ?? []).map((r) => r.santri_id));
    if (pengecualian.some((p) => !anggotaSet.has(p.santri_id))) {
      return { ok: false, error: "Ada santri yang bukan anggota kelas ini." };
    }
  }

  // Tandai submission + hapus catatan lama + tulis catatan baru dalam SATU
  // transaksi lewat RPC (bukan 3 pernyataan terpisah seperti sebelumnya) —
  // kalau langkah terakhir gagal di tengah (RLS/jaringan/timeout/tabrakan
  // unique), sebelumnya checkpoint tetap tertandai "sudah diisi" padahal
  // catatan lamanya sudah kehapus duluan (rekap jadi melaporkan semua
  // hadir). Lihat migrasi 0045 untuk detail fungsinya.
  const { error } = await supabase.rpc("submit_absensi_santri", {
    p_kelas_id: kelasId,
    p_checkpoint_id: checkpointId,
    p_tanggal: tanggal,
    p_pengecualian: pengecualian,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/absensi-santri");
  revalidatePath("/rekap-absensi-santri");
  return { ok: true };
}
