"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canCatatanHarian, getProfile } from "@/lib/auth/dal";
import { todayJakarta } from "@/lib/absensi-status";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import type { JenisCatatan } from "@/lib/catatan-harian";

const MAX_ISI = 1000;
const JENIS_SAH: JenisCatatan[] = ["baik", "perhatian", "info"];

function validasi(tanggal: string, jenis: string, isi: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return "Format tanggal tidak valid.";
  // Tanggal masa depan ditolak: catatan harian mengabarkan yang SUDAH
  // terjadi, dan tanggal maju membuat urutan di portal wali jadi kacau.
  if (tanggal > todayJakarta()) return "Tanggal tidak boleh melewati hari ini.";
  if (!JENIS_SAH.includes(jenis as JenisCatatan)) return "Jenis catatan tidak valid.";
  const teks = isi.trim();
  if (teks.length === 0) return "Isi catatan tidak boleh kosong.";
  if (teks.length > MAX_ISI) return `Catatan maksimal ${MAX_ISI} karakter.`;
  return null;
}

/**
 * Kelas yang dipakai menyimpan catatan = IRISAN antara kelas santri ybs dan
 * kelas yang diampu pemanggil, dibatasi tahun ajaran aktif.
 *
 * Bukan sekadar "kelas pertama santri itu": seorang santri bisa tercatat di
 * lebih dari satu kelas, dan mengambil yang pertama ditemukan bisa
 * menghasilkan kelas yang bukan kelas si penulis — lalu ditolak RLS dengan
 * pesan membingungkan, atau lebih buruk, tersimpan atas nama kelas keliru.
 */
async function kelasUntukSantri(
  santriId: string,
  pegawaiId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return null;

  const [{ data: kelasSantri }, { data: kelasDiampu }] = await Promise.all([
    supabase
      .from("santri_kelas")
      .select("kelas_id, kelas:kelas!inner(tahun_ajaran_id)")
      .eq("santri_id", santriId)
      .eq("kelas.tahun_ajaran_id", ta.id),
    supabase.from("guru_kelas").select("kelas_id").eq("pegawai_id", pegawaiId),
  ]);

  // Seluruh larik di-cast sekali di depan. Project ini tidak punya generated
  // types dari Supabase, jadi hasil query dengan embed ter-infer longgar —
  // mencocokkan tipe per-elemen di dalam `.find()` gampang gagal kompilasi.
  const daftarKelasSantri = (kelasSantri ?? []) as unknown as { kelas_id: string }[];
  const daftarKelasDiampu = (kelasDiampu ?? []) as unknown as { kelas_id: string }[];

  const diampu = new Set(daftarKelasDiampu.map((r) => r.kelas_id));
  return daftarKelasSantri.find((r) => diampu.has(r.kelas_id))?.kelas_id ?? null;
}

export async function tambahCatatanHarian(
  santriId: string,
  tanggal: string,
  jenis: string,
  isi: string,
): Promise<FormResult> {
  if (!(await canCatatanHarian())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();
  if (!profile?.pegawai_id) {
    return { ok: false, error: "Akun ini tidak terhubung ke data pegawai." };
  }
  const pesan = validasi(tanggal, jenis, isi);
  if (pesan) return { ok: false, error: pesan };

  const kelasId = await kelasUntukSantri(santriId, profile.pegawai_id);
  if (!kelasId) {
    return { ok: false, error: "Santri ini bukan anggota kelas yang Anda ampu." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("catatan_harian").insert({
    santri_id: santriId,
    kelas_id: kelasId,
    tanggal,
    jenis,
    isi: isi.trim(),
    dicatat_oleh: profile.pegawai_id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/catatan-harian");
  return { ok: true };
}

export async function ubahCatatanHarian(
  id: string,
  tanggal: string,
  jenis: string,
  isi: string,
): Promise<FormResult> {
  if (!(await canCatatanHarian())) return { ok: false, error: "Tidak diizinkan." };
  const pesan = validasi(tanggal, jenis, isi);
  if (pesan) return { ok: false, error: pesan };

  const supabase = await createClient();
  // `select` dipakai untuk mendeteksi baris yang tidak tersentuh — tanpa itu,
  // update yang ditolak RLS sukses secara diam-diam dengan 0 baris terpengaruh.
  const { data, error } = await supabase
    .from("catatan_harian")
    .update({
      tanggal,
      jenis,
      isi: isi.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau bukan milik Anda." };
  }

  revalidatePath("/catatan-harian");
  return { ok: true };
}

export async function hapusCatatanHarian(id: string): Promise<FormResult> {
  if (!(await canCatatanHarian())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catatan_harian")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Catatan tidak ditemukan atau bukan milik Anda." };
  }

  revalidatePath("/catatan-harian");
  return { ok: true };
}
