import { z } from "zod";

export const peranSchema = z.object({
  nama: z.string().trim().min(1, "Nama peran wajib diisi.").max(50),
  deskripsi: z.string().trim().optional(),
  perm_input_poin: z.boolean(),
  perm_laporan: z.boolean(),
  perm_master: z.boolean(),
  perm_akun: z.boolean(),
  perm_kesehatan: z.boolean(),
  scope_kelas: z.boolean(),
  perm_santri: z.boolean(),
  perm_pegawai: z.boolean(),
  perm_akun_staff: z.boolean(),
});

export type PeranInput = z.infer<typeof peranSchema>;

export type PeranRow = {
  id: string;
  nama: string;
  deskripsi: string | null;
  perm_input_poin: boolean;
  perm_laporan: boolean;
  perm_master: boolean;
  perm_akun: boolean;
  perm_kesehatan: boolean;
  scope_kelas: boolean;
  perm_santri: boolean;
  perm_pegawai: boolean;
  perm_akun_staff: boolean;
  is_super: boolean;
};
