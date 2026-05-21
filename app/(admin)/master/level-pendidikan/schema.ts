import { z } from "zod";

export const levelSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(50),
  urutan: z
    .number({ error: "Urutan harus berupa angka." })
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0."),
});

export type LevelInput = z.infer<typeof levelSchema>;
