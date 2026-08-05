"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canAbsensiSantri, getProfile } from "@/lib/auth/dal";
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

  const { error: subError } = await supabase
    .from("absensi_santri_submission")
    .upsert(
      {
        checkpoint_id: checkpointId,
        kelas_id: kelasId,
        tanggal,
        dicatat_oleh: profile.pegawai_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "checkpoint_id,kelas_id,tanggal" },
    );
  if (subError) return { ok: false, error: dbErrorMessage(subError) };

  const { error: delError } = await supabase
    .from("absensi_santri")
    .delete()
    .eq("checkpoint_id", checkpointId)
    .eq("kelas_id", kelasId)
    .eq("tanggal", tanggal);
  if (delError) return { ok: false, error: dbErrorMessage(delError) };

  if (pengecualian.length > 0) {
    const { error: insError } = await supabase.from("absensi_santri").insert(
      pengecualian.map((p) => ({
        santri_id: p.santri_id,
        checkpoint_id: checkpointId,
        kelas_id: kelasId,
        tanggal,
        status: p.status,
        catatan: p.catatan,
      })),
    );
    if (insError) return { ok: false, error: dbErrorMessage(insError) };
  }

  revalidatePath("/absensi-santri");
  revalidatePath("/rekap-absensi-santri");
  return { ok: true };
}
