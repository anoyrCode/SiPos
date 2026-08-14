// Perhitungan BAP (Berita Acara Pengawasan) — murni, tanpa akses database,
// supaya halaman musyrif dan halaman rekap admin memakai rumus yang sama
// persis tanpa duplikasi yang bisa diam-diam berbeda.

export type BapStatus = "izin" | "sakit" | "alpa";

/** Satu baris pengecualian mentah, sudah di-join ke santri & checkpoint. */
export type BapPengecualianRow = {
  santri_id: string;
  nama: string;
  nis: string | null;
  status: BapStatus;
  /** Jam checkpoint, format "HH:MM:SS" dari kolom `time` Postgres. */
  jam: string;
  /** Kolom `urutan` checkpoint — WAJIB, lihat catatan di jamList. */
  urutan: number;
  catatan: string | null;
};

export type BapSantriTidakHadir = {
  santriId: string;
  nama: string;
  nis: string | null;
  status: BapStatus;
  /** Jam-jam ("HH:MM") santri ini tidak hadir, urut jalannya shift. */
  jamList: string[];
  catatan: string | null;
};

export type BapData = {
  seharusnya: number;
  jumlahSantri: number;
  tidakHadir: number;
  yakni: BapSantriTidakHadir[];
};

// Status paling berat menang saat satu santri punya status berbeda di jam
// berbeda (mis. izin jam 05:15 lalu alpa jam 09:00 — yang dilaporkan alpa).
const BOBOT: Record<BapStatus, number> = { izin: 1, sakit: 2, alpa: 3 };

export function hitungBap(totalRoster: number, rows: BapPengecualianRow[]): BapData {
  const perSantri = new Map<
    string,
    {
      nama: string;
      nis: string | null;
      status: BapStatus;
      entries: { jam: string; urutan: number }[];
      catatan: string[];
    }
  >();

  for (const r of rows) {
    const catatan = r.catatan?.trim();
    const cur = perSantri.get(r.santri_id);
    if (!cur) {
      perSantri.set(r.santri_id, {
        nama: r.nama,
        nis: r.nis,
        status: r.status,
        entries: [{ jam: r.jam, urutan: r.urutan }],
        catatan: catatan ? [catatan] : [],
      });
      continue;
    }
    if (BOBOT[r.status] > BOBOT[cur.status]) cur.status = r.status;
    cur.entries.push({ jam: r.jam, urutan: r.urutan });
    // Gabungkan catatan dari semua jam — mengambil satu saja akan membuang
    // keterangan dari jam lain tanpa jejak.
    if (catatan && !cur.catatan.includes(catatan)) cur.catatan.push(catatan);
  }

  const yakni: BapSantriTidakHadir[] = [...perSantri.entries()]
    .map(([santriId, v]) => ({
      santriId,
      nama: v.nama,
      nis: v.nis,
      status: v.status,
      // Diurutkan dari `urutan`, BUKAN nilai `jam` mentah. Shift 3 melewati
      // tengah malam (21:00 -> 04:50), jadi mengurutkan dari jam mentah akan
      // menaruh 01:00 sebelum 21:00 — salah.
      jamList: [...v.entries]
        .sort((a, b) => a.urutan - b.urutan)
        .map((e) => e.jam.slice(0, 5)),
      catatan: v.catatan.length > 0 ? v.catatan.join("; ") : null,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const tidakHadir = yakni.length;
  return {
    seharusnya: totalRoster,
    tidakHadir,
    // Math.max WAJIB: absensi_santri.kelas_id adalah snapshot saat dicatat,
    // sedangkan totalRoster dihitung dari keanggotaan kelas SEKARANG. Santri
    // yang ditandai tidak hadir lalu pindah kelas tetap terhitung di
    // tidakHadir tapi hilang dari roster, sehingga selisihnya bisa negatif.
    jumlahSantri: Math.max(0, totalRoster - tidakHadir),
    yakni,
  };
}

const STATUS_TEKS: Record<BapStatus, string> = {
  izin: "izin",
  sakit: "sakit",
  alpa: "alpa",
};

/**
 * Versi teks polos untuk disalin ke grup WhatsApp. Sengaja tanpa karakter
 * khusus supaya aman ditempel di aplikasi apa pun.
 */
export function formatBapWhatsApp(params: {
  kelas: string;
  shift: number;
  tanggalLabel: string;
  musyrif: string;
  data: BapData;
  catatan: { jam: string; isi: string }[];
}): string {
  const { kelas, shift, tanggalLabel, musyrif, data, catatan } = params;

  const baris: string[] = [
    "BERITA ACARA PENGAWASAN",
    `${kelas} - Shift ${shift}`,
    tanggalLabel,
    "",
    `Jumlah santri : ${data.jumlahSantri}`,
    `Seharusnya    : ${data.seharusnya}`,
    `Tidak Hadir   : ${data.tidakHadir}`,
  ];

  // Daftar bernomor baris, bukan satu baris dipisah koma: keterangan tiap
  // santri ("mengundurkan diri dari pondok") membuat versi satu baris jadi
  // paragraf panjang yang sulit dibaca di WhatsApp.
  if (data.yakni.length === 0) {
    baris.push("Yakni         : -");
  } else {
    baris.push("Yakni         :");
    for (const y of data.yakni) {
      const inti = `${y.nama} (${STATUS_TEKS[y.status]}, ${y.jamList.join("/")})`;
      baris.push(`- ${inti}${y.catatan ? ` - ${y.catatan}` : ""}`);
    }
  }

  baris.push("", "Catatan selama pengawasan:");

  if (catatan.length === 0) {
    baris.push("- (tidak ada)");
  } else {
    for (const c of catatan) baris.push(`- ${c.jam.slice(0, 5)} ${c.isi}`);
  }

  baris.push("", `Musyrif: ${musyrif}`);
  return baris.join("\n");
}
