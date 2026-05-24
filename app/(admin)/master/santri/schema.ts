import { z } from "zod";

export const SANTRI_STATUS = ["aktif", "lulus", "keluar"] as const;

export const santriSchema = z.object({
  nis: z.string().trim().optional(),
  nisn: z.string().trim().optional(),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(150),
  email: z
    .string()
    .trim()
    .email("Email tidak valid.")
    .or(z.literal(""))
    .optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  nama_ayah: z.string().trim().optional(),
  nama_ibu: z.string().trim().optional(),
  nama_wali: z.string().trim().optional(),
  no_telp_wali: z.string().trim().optional(),
  status: z.enum(SANTRI_STATUS),
});

export type SantriInput = z.infer<typeof santriSchema>;

export type SantriRow = {
  id: string;
  nis: string | null;
  nisn: string | null;
  nama: string;
  email: string | null;
  jenis_kelamin: "L" | "P" | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  nama_wali: string | null;
  no_telp_wali: string | null;
  status: "aktif" | "lulus" | "keluar";
};
