"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canApproveAbsensi, canRekapAbsensi, getProfile } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/rekap-absensi";

export async function updatePengaturanAbsensi(input: {
  lokasi_lat: number;
  lokasi_long: number;
  radius_meter: number;
  toleransi_menit: number;
  tanggal_mulai: string | null;
}): Promise<FormResult> {
  if (!(await canRekapAbsensi())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("absensi_pengaturan")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!setting) return { ok: false, error: "Baris pengaturan tidak ditemukan." };

  const { error } = await supabase
    .from("absensi_pengaturan")
    .update({
      lokasi_lat: input.lokasi_lat,
      lokasi_long: input.lokasi_long,
      radius_meter: input.radius_meter,
      toleransi_menit: input.toleransi_menit,
      tanggal_mulai: input.tanggal_mulai,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setting.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function setujuiPengajuan(id: string): Promise<FormResult> {
  if (!(await canApproveAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: pengajuan } = await supabase
    .from("absensi_pengajuan")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!pengajuan) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (pengajuan.status !== "menunggu") {
    return { ok: false, error: "Pengajuan ini sudah diproses." };
  }

  const { error } = await supabase
    .from("absensi_pengajuan")
    .update({
      status: "disetujui",
      diproses_oleh: profile?.id ?? null,
      diproses_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function tolakPengajuan(
  id: string,
  alasan: string,
): Promise<FormResult> {
  if (!(await canApproveAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  if (!alasan.trim()) return { ok: false, error: "Alasan penolakan wajib diisi." };
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: pengajuan } = await supabase
    .from("absensi_pengajuan")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!pengajuan) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (pengajuan.status !== "menunggu") {
    return { ok: false, error: "Pengajuan ini sudah diproses." };
  }

  const { error: updateErr } = await supabase
    .from("absensi_pengajuan")
    .update({
      status: "ditolak",
      alasan_penolakan: alasan.trim(),
      diproses_oleh: profile?.id ?? null,
      diproses_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateErr) return { ok: false, error: dbErrorMessage(updateErr) };

  await supabase.from("absensi").delete().eq("pengajuan_id", id);

  revalidatePath(PATH);
  revalidatePath("/absensi");
  return { ok: true };
}

const MAX_RENTANG_LIBUR_HARI = 180;

/** Daftar tanggal "YYYY-MM-DD" dari mulai s.d. selesai (inklusif). */
function dateRange(mulai: string, selesai: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${mulai}T00:00:00Z`);
  const end = new Date(`${selesai}T00:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function addLiburKhusus(
  tanggalMulai: string,
  tanggalSelesai: string,
  keterangan: string,
): Promise<FormResult> {
  if (!(await canRekapAbsensi())) return { ok: false, error: "Tidak diizinkan." };
  if (!tanggalMulai || !tanggalSelesai) {
    return { ok: false, error: "Tanggal wajib diisi." };
  }
  if (!keterangan.trim()) return { ok: false, error: "Keterangan wajib diisi." };
  if (tanggalSelesai < tanggalMulai) {
    return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  }

  const dates = dateRange(tanggalMulai, tanggalSelesai);
  if (dates.length > MAX_RENTANG_LIBUR_HARI) {
    return {
      ok: false,
      error: `Rentang tanggal maksimal ${MAX_RENTANG_LIBUR_HARI} hari.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("libur_khusus").upsert(
    dates.map((tanggal) => ({ tanggal, keterangan: keterangan.trim() })),
    { onConflict: "tanggal" },
  );
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi");
  return { ok: true };
}

export async function deleteLiburKhusus(tanggal: string): Promise<FormResult> {
  if (!(await canRekapAbsensi())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("libur_khusus")
    .delete()
    .eq("tanggal", tanggal);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi");
  return { ok: true };
}
