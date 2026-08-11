import { z } from "zod";

export const kelasSchema = z.object({
  nama_kelas: z.string().trim().min(1, "Nama kelas wajib diisi.").max(50),
  level_pendidikan_id: z.string().min(1, "Level pendidikan wajib dipilih."),
  tahun_ajaran_id: z.string().min(1, "Tahun ajaran wajib dipilih."),
  wali_id: z.string().optional(),
  jenis_kelamin: z.string().optional(),
});

export type KelasInput = z.infer<typeof kelasSchema>;

export type Option = { value: string; label: string };

/** Label gender khusus kelas — beda dari santri/pegawai yang pakai Laki-laki/Perempuan. */
export const KELAS_JK_LABEL: Record<"L" | "P", string> = {
  L: "Putra",
  P: "Putri",
};

export type KelasRow = {
  id: string;
  nama_kelas: string;
  level_pendidikan_id: string | null;
  tahun_ajaran_id: string | null;
  wali_id: string | null;
  jenis_kelamin: "L" | "P" | null;
  level: { nama: string } | null;
  tahun: { tahun: string } | null;
  wali: { nama: string } | null;
};
