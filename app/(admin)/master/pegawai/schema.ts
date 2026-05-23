import { z } from "zod";

export const pegawaiSchema = z.object({
  nip: z.string().trim().optional(),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(150),
  email: z
    .string()
    .trim()
    .email("Email tidak valid.")
    .or(z.literal(""))
    .optional(),
  jabatan: z.string().trim().optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  telp: z.string().trim().optional(),
  tempat_lahir: z.string().trim().optional(),
  tanggal_lahir: z.string().optional(),
  alamat: z.string().trim().optional(),
});

export type PegawaiInput = z.infer<typeof pegawaiSchema>;

export type PegawaiRow = {
  id: string;
  nip: string | null;
  nama: string;
  email: string | null;
  jabatan: string | null;
  jenis_kelamin: "L" | "P" | null;
  telp: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  alamat: string | null;
};
