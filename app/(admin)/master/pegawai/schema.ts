import { z } from "zod";

/** 1 slot jadwal hari (dipakai array 7-elemen, index = hari 0=Minggu..6=Sabtu). */
export type JadwalHarianSlot = {
  jam_masuk: string | null;
  jam_pulang: string | null;
};

/** 1 entri jadwal sementara (rentang tanggal) — daftar/riwayat, tambah/hapus saja. */
export type JadwalSementaraRow = {
  id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jam_masuk: string;
  jam_pulang: string;
  keterangan: string | null;
};

/** 1 baris master jabatan — dikelola inline dari halaman Pegawai (dialog "Kelola Jabatan"), bukan preset hardcoded. */
export type JabatanRow = {
  id: string;
  nama: string;
  is_aktif: boolean;
  is_guru: boolean;
};

/** Susun baris `pegawai_jadwal_harian` (sparse, cuma hari yg keisi) jadi array 7 elemen. */
export function buildJadwalHarianSlots(
  rows: { hari: number; jam_masuk: string | null; jam_pulang: string | null }[],
): JadwalHarianSlot[] {
  const slots: JadwalHarianSlot[] = Array.from({ length: 7 }, () => ({
    jam_masuk: null,
    jam_pulang: null,
  }));
  for (const r of rows) {
    if (r.hari >= 0 && r.hari <= 6) {
      slots[r.hari] = { jam_masuk: r.jam_masuk, jam_pulang: r.jam_pulang };
    }
  }
  return slots;
}

const jadwalHarianSlotSchema = z.object({
  jam_masuk: z.string().trim().optional(),
  jam_pulang: z.string().trim().optional(),
});

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
  jabatan_tambahan: z.array(z.string()).optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  telp: z.string().trim().optional(),
  tempat_lahir: z.string().trim().optional(),
  tanggal_lahir: z.string().optional(),
  alamat: z.string().trim().optional(),
  jam_masuk_jadwal: z.string().trim().optional(),
  jam_pulang_jadwal: z.string().trim().optional(),
  hari_libur: z.string().optional(),
  jadwal_fleksibel: z.boolean(),
  jadwal_harian_berbeda: z.boolean(),
  jadwal_harian: z.array(jadwalHarianSlotSchema).length(7),
  shift_ganda: z.boolean(),
  jam_masuk_jadwal_2: z.string().trim().optional(),
  jam_pulang_jadwal_2: z.string().trim().optional(),
  tanggal_mulai_absensi: z.string().trim().optional(),
  bebas_lokasi: z.boolean(),
});

export type PegawaiInput = z.infer<typeof pegawaiSchema>;

export type PegawaiRow = {
  id: string;
  nip: string | null;
  nama: string;
  email: string | null;
  jabatan: string | null;
  jabatan_tambahan: string[];
  jenis_kelamin: "L" | "P" | null;
  telp: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  alamat: string | null;
  jam_masuk_jadwal: string | null;
  jam_pulang_jadwal: string | null;
  hari_libur: number | null;
  jadwal_fleksibel: boolean;
  jadwal_harian_berbeda: boolean;
  jadwal_harian: JadwalHarianSlot[];
  shift_ganda: boolean;
  jam_masuk_jadwal_2: string | null;
  jam_pulang_jadwal_2: string | null;
  tanggal_mulai_absensi: string | null;
  jadwal_sementara: JadwalSementaraRow[];
  bebas_lokasi: boolean;
};
