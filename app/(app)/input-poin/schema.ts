import { z } from "zod";

export type SantriHit = {
  id: string;
  nis: string | null;
  nama: string;
  kelas: string | null;
};

export type PoinOpt = {
  id: string;
  kode_poin: string;
  nama_poin: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  level: string | null;
};

export const inputPoinSchema = z.object({
  santri_ids: z.array(z.string()).min(1, "Pilih minimal satu santri."),
  master_poin_ids: z.array(z.string()).min(1, "Pilih minimal satu poin."),
  nilai_poin: z
    .number({ error: "Nilai harus berupa angka." })
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0."),
  is_override: z.boolean(),
  tanggal_kejadian: z.string().min(1, "Tanggal wajib diisi."),
  catatan: z.string().optional(),
});

export type InputPoinValues = z.infer<typeof inputPoinSchema>;
