"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/rekap-absensi";

export async function updatePengaturanAbsensi(input: {
  lokasi_lat: number;
  lokasi_long: number;
  radius_meter: number;
}): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

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
      updated_at: new Date().toISOString(),
    })
    .eq("id", setting.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
