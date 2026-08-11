"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster } from "@/lib/auth/dal";
import { dbErrorMessage, type FormResult } from "@/lib/forms";
import { KELAS_JK_LABEL, kelasSchema, type KelasInput } from "./schema";

const PATH = "/master/kelas";

function payload(input: KelasInput) {
  return {
    nama_kelas: input.nama_kelas,
    level_pendidikan_id: input.level_pendidikan_id,
    tahun_ajaran_id: input.tahun_ajaran_id,
    wali_id: input.wali_id || null,
    jenis_kelamin: input.jenis_kelamin || null,
  };
}

export async function createKelas(input: KelasInput): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = kelasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("kelas").insert(payload(parsed.data));
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateKelas(
  id: string,
  input: KelasInput,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };
  const parsed = kelasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();

  // Menandai gender kelas yang sudah berisi santri gender lain akan
  // meninggalkan data tidak konsisten yang tidak akan dibereskan siapa pun —
  // tolak dulu, minta santrinya dipindahkan.
  //
  // Hanya diperiksa saat gendernya benar-benar BERUBAH. Kalau ikut memeriksa
  // di setiap penyimpanan, admin yang cuma mengganti nama/wali kelas ikut
  // terblokir oleh ketidakcocokan lama (mis. gender santri diedit belakangan)
  // — dengan pesan yang menyesatkan pula, karena dia tidak sedang menandai
  // gender apa pun.
  const jk = parsed.data.jenis_kelamin;
  const { data: kelasLama, error: kelasLamaError } = await supabase
    .from("kelas")
    .select("jenis_kelamin")
    .eq("id", id)
    .single();
  if (kelasLamaError || !kelasLama) {
    return { ok: false, error: "Gagal membaca data kelas. Coba lagi sebentar." };
  }
  const gantiGender = (kelasLama.jenis_kelamin ?? "") !== (jk ?? "");

  if (gantiGender && (jk === "L" || jk === "P")) {
    const lawan = jk === "L" ? "P" : "L";
    const { count, error: cekError } = await supabase
      .from("santri_kelas")
      .select("santri!inner(id)", { count: "exact", head: true })
      .eq("kelas_id", id)
      .eq("santri.jenis_kelamin", lawan);
    // Gagal memeriksa = tolak, jangan diteruskan. Kalau errornya diabaikan,
    // `count` jadi null dan gerbang ini lolos diam-diam — persis kebalikan
    // dari tujuannya.
    if (cekError) {
      return {
        ok: false,
        error: "Gagal memeriksa isi kelas. Coba lagi sebentar.",
      };
    }
    if ((count ?? 0) > 0) {
      const labelLawan = lawan === "L" ? "Laki-laki" : "Perempuan";
      return {
        ok: false,
        error: `Kelas ini masih berisi ${count} santri ${labelLawan}. Pindahkan atau keluarkan dulu sebelum menandai kelas ini ${KELAS_JK_LABEL[jk]}.`,
      };
    }
  }

  const { error } = await supabase
    .from("kelas")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteKelas(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();

  // santri_kelas/guru_kelas pakai on delete cascade — kalau masih ada
  // santri/musyrif di kelas ini, blokir dulu (jangan diam-diam terhapus).
  const [santriCount, guruCount] = await Promise.all([
    supabase
      .from("santri_kelas")
      .select("id", { count: "exact", head: true })
      .eq("kelas_id", id),
    supabase
      .from("guru_kelas")
      .select("id", { count: "exact", head: true })
      .eq("kelas_id", id),
  ]);
  if ((santriCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kelas masih punya ${santriCount.count} santri. Pindahkan santri dulu.`,
    };
  }
  if ((guruCount.count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kelas masih ditugaskan ke ${guruCount.count} musyrif. Ubah penugasan dulu.`,
    };
  }

  const { error } = await supabase.from("kelas").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  return { ok: true };
}
