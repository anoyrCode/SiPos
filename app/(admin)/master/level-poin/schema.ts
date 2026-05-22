import { z } from "zod";

export const levelPoinSchema = z.object({
  tipe: z.enum(["POSITIF", "NEGATIF"], { error: "Pilih tipe." }),
  nama: z.string().trim().min(1, "Nama level wajib diisi.").max(50),
  urutan: z
    .number({ error: "Urutan harus berupa angka." })
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0."),
});

export type LevelPoinInput = z.infer<typeof levelPoinSchema>;

export type LevelPoinRow = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nama: string;
  urutan: number;
};
