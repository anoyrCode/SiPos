"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canPegawai } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { pegawaiSchema, type PegawaiInput } from "./schema";

const PATH = "/master/pegawai";

function payload(input: PegawaiInput) {
  const jadwalTerkunci = input.jadwal_fleksibel || input.jadwal_harian_berbeda;
  return {
    nip: input.nip || null,
    nama: input.nama,
    email: input.email || null,
    jabatan: input.jabatan || null,
    jabatan_tambahan: input.jabatan_tambahan ?? [],
    jenis_kelamin: input.jenis_kelamin ?? null,
    telp: input.telp || null,
    tempat_lahir: input.tempat_lahir || null,
    tanggal_lahir: input.tanggal_lahir || null,
    alamat: input.alamat || null,
    jam_masuk_jadwal: jadwalTerkunci ? null : input.jam_masuk_jadwal || null,
    jam_pulang_jadwal: jadwalTerkunci ? null : input.jam_pulang_jadwal || null,
    hari_libur:
      input.hari_libur !== undefined && input.hari_libur !== ""
        ? Number(input.hari_libur)
        : null,
    jadwal_fleksibel: input.jadwal_fleksibel,
    jadwal_harian_berbeda: input.jadwal_harian_berbeda,
    shift_ganda: input.shift_ganda,
    jam_masuk_jadwal_2: input.shift_ganda ? input.jam_masuk_jadwal_2 || null : null,
    jam_pulang_jadwal_2: input.shift_ganda ? input.jam_pulang_jadwal_2 || null : null,
  };
}

/** Maksimal 1 dari 3 mode jadwal (fleksibel/harian-berbeda/shift-ganda) boleh aktif. */
function validasiModeJadwal(input: PegawaiInput): string | null {
  const aktif = [
    input.jadwal_fleksibel,
    input.jadwal_harian_berbeda,
    input.shift_ganda,
  ].filter(Boolean).length;
  if (aktif > 1) {
    return "Jadwal Fleksibel, Jadwal Beda per Hari, dan Shift Ganda tidak boleh aktif bersamaan.";
  }
  return null;
}

/** Hapus semua baris jadwal harian pegawai lalu insert ulang (replace-all, tabel kecil maks 7 baris). */
async function saveJadwalHarian(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pegawaiId: string,
  input: PegawaiInput,
): Promise<FormResult> {
  const { error: delErr } = await supabase
    .from("pegawai_jadwal_harian")
    .delete()
    .eq("pegawai_id", pegawaiId);
  if (delErr) return { ok: false, error: dbErrorMessage(delErr) };

  if (!input.jadwal_harian_berbeda) return { ok: true };

  const rows = input.jadwal_harian
    .map((slot, hari) => ({
      pegawai_id: pegawaiId,
      hari,
      jam_masuk: slot.jam_masuk || null,
      jam_pulang: slot.jam_pulang || null,
    }))
    .filter((r) => r.jam_masuk || r.jam_pulang);
  if (rows.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("pegawai_jadwal_harian")
    .insert(rows);
  if (insErr) return { ok: false, error: dbErrorMessage(insErr) };
  return { ok: true };
}

export async function createPegawai(input: PegawaiInput): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = pegawaiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const errModeJadwal = validasiModeJadwal(parsed.data);
  if (errModeJadwal) return { ok: false, error: errModeJadwal };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pegawai")
    .insert(payload(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const jadwalResult = await saveJadwalHarian(supabase, data.id, parsed.data);
  if (!jadwalResult.ok) return jadwalResult;

  revalidatePath(PATH);
  return { ok: true };
}

export async function updatePegawai(
  id: string,
  input: PegawaiInput,
): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = pegawaiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };
  const errModeJadwal = validasiModeJadwal(parsed.data);
  if (errModeJadwal) return { ok: false, error: errModeJadwal };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pegawai")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const jadwalResult = await saveJadwalHarian(supabase, id, parsed.data);
  if (!jadwalResult.ok) return jadwalResult;

  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePegawai(id: string): Promise<FormResult> {
  if (!(await canPegawai())) return { ok: false, error: "Tidak diizinkan." };
  const supabase = await createClient();
  const { error } = await supabase.from("pegawai").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(PATH);
  return { ok: true };
}
