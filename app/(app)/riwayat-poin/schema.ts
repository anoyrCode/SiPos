import { z } from "zod";

export const editTransaksiSchema = z.object({
  tanggal_kejadian: z.string().min(1, "Tanggal wajib diisi."),
  nilai_poin: z
    .number({ error: "Nilai harus berupa angka." })
    .int("Harus bilangan bulat.")
    .min(1, "Minimal 1."),
  catatan: z.string().optional(),
});

export type EditTransaksiInput = z.infer<typeof editTransaksiSchema>;
