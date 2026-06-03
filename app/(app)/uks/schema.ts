import { z } from "zod";

export type SantriHit = { id: string; nis: string | null; nama: string };

export const rekamSchema = z.object({
  santri_id: z.string().min(1, "Pilih santri."),
  tanggal: z.string().min(1, "Tanggal wajib diisi."),
  keluhan: z.string().trim().min(1, "Keluhan wajib diisi.").max(500),
  tindakan: z.string().trim().max(500).optional(),
  obat: z.string().trim().max(200).optional(),
  catatan: z.string().trim().max(500).optional(),
});

export type RekamInput = z.infer<typeof rekamSchema>;

export type RekamRow = {
  id: string;
  tanggal: string;
  keluhan: string;
  tindakan: string | null;
  obat: string | null;
  catatan: string | null;
  santri: { nama: string; nis: string | null } | null;
  petugas: { nama: string } | null;
};
