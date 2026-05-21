import { z } from "zod";

export const tahunAjaranSchema = z.object({
  tahun: z
    .string()
    .trim()
    .min(1, "Tahun ajaran wajib diisi.")
    .regex(/^\d{4}\/\d{4}$/, "Format harus seperti 2026/2027."),
  tanggal_mulai: z.string().optional(),
  tanggal_selesai: z.string().optional(),
  is_aktif: z.boolean(),
});

export type TahunAjaranInput = z.infer<typeof tahunAjaranSchema>;
