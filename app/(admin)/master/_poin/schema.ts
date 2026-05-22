import { z } from "zod";

export type PoinTipe = "POSITIF" | "NEGATIF";

export const poinSchema = z.object({
  kode_poin: z.string().trim().min(1, "Kode poin wajib diisi.").max(20),
  nama_poin: z.string().trim().min(1, "Nama poin wajib diisi.").max(150),
  deskripsi_poin: z.string().trim().optional(),
  nilai_poin: z
    .number({ error: "Nilai harus berupa angka." })
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0."),
  level: z.string().trim().optional(),
  keterangan: z.string().trim().optional(),
  is_aktif: z.boolean(),
});

export type PoinInput = z.infer<typeof poinSchema>;

export type PoinRow = {
  id: string;
  kode_poin: string;
  nama_poin: string;
  deskripsi_poin: string | null;
  nilai_poin: number;
  level: string | null;
  keterangan: string | null;
  is_aktif: boolean;
};
