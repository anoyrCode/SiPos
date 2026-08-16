"use server";

import { createClient } from "@/lib/supabase/server";
import { canRekapAbsensiSantri } from "@/lib/auth/dal";
import {
  hitungBap,
  type BapData,
  type BapPengecualianRow,
} from "@/lib/bap-absensi-santri";

// Berkas terpisah dari `actions.ts` (yang sudah menangani checkpoint & export
// rekap kehadiran) supaya masing-masing tetap satu tanggung jawab. Helper
// kecil di bawah sengaja disalin lokal, bukan diekspor dari actions.ts:
// berkas "use server" hanya boleh mengekspor fungsi async, jadi helper sinkron
// tidak bisa dibagi lewat sana. Pola salin-lokal ini sudah dipakai di
// beberapa tempat lain di project ini.

const PAGE_SIZE = 1000;
const MAX_RENTANG_BAP_HARI = 31;

type KelasRingkas = {
  id: string;
  nama_kelas: string;
  jenis_kelamin: "L" | "P" | null;
};

export type BapRekapRow = {
  tanggal: string;
  kelasId: string;
  kelas: string;
  jenisKelamin: "L" | "P" | null;
  shift: number;
  jumlahSantri: number;
  seharusnya: number;
  tidakHadir: number;
  jamTerisi: number;
  jamTotal: number;
  musyrif: string;
  jamPengecekan: string[];
  // Bentuk TERSTRUKTUR, bukan teks yang sudah diringkas. PDF menyusun tata
  // letaknya sendiri lewat `drawBapPage`, dan Excel memecah keduanya jadi
  // sheet rincian satu baris per kejadian — keduanya butuh datanya utuh.
  data: BapData;
  catatanList: { jam: string; isi: string }[];
};

export type BapRekapResult =
  | { ok: true; rows: BapRekapRow[] }
  | { ok: false; error: string };

/** Jumlah hari kalender dari `dari` sampai `sampai`, inklusif. NaN bila format salah. */
function hitungHari(dari: string, sampai: string): number {
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Semua tanggal ISO dari `dari` sampai `sampai`, inklusif. */
function daftarTanggal(dari: string, sampai: string): string[] {
  const hasil: string[] = [];
  const akhir = Date.parse(`${sampai}T00:00:00Z`);
  for (let t = Date.parse(`${dari}T00:00:00Z`); t <= akhir; t += 86_400_000) {
    hasil.push(new Date(t).toISOString().slice(0, 10));
  }
  return hasil;
}

/**
 * Ambil SEMUA baris lewat paginasi. PostgREST memotong di 1000 baris tanpa
 * error — untuk rentang 31 hari x banyak kelas, `absensi_santri` gampang
 * menembus itu dan angkanya jadi salah diam-diam.
 */
async function ambilSemua<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>,
): Promise<{ rows: T[]; gagal: boolean }> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) return { rows, gagal: true };
    const batch = data ?? [];
    rows.push(...(batch as unknown as T[]));
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows, gagal: false };
}

/**
 * Rekap BAP untuk banyak kelas sekaligus.
 *
 * `shiftFilter` 0 berarti semua shift. `jk` mengikuti filter halaman:
 * "L" / "P" / "kosong" / "" (semua).
 *
 * Baris tetap dikeluarkan walau jamnya belum lengkap — kolom kelengkapan yang
 * menandainya. Kelas yang absensinya bolong justru yang perlu ketahuan; kalau
 * barisnya dibuang, laporan terlihat rapi padahal ada yang tidak mengerjakan.
 */
export async function getRekapBapRentang(
  dari: string,
  sampai: string,
  shiftFilter: number,
  jk: string,
): Promise<BapRekapResult> {
  if (!(await canRekapAbsensiSantri())) {
    return { ok: false, error: "Tidak diizinkan." };
  }

  // Divalidasi ulang di server — server action bisa dipanggil langsung tanpa
  // lewat UI, jadi pemeriksaan di klien saja tidak cukup.
  if (!dari || !sampai) {
    return { ok: false, error: "Tanggal Dari dan Sampai wajib diisi." };
  }
  const totalHari = hitungHari(dari, sampai);
  if (Number.isNaN(totalHari)) {
    return { ok: false, error: "Format tanggal tidak valid." };
  }
  if (totalHari < 1) {
    return {
      ok: false,
      error: "Tanggal Sampai tidak boleh lebih awal dari tanggal Dari.",
    };
  }
  if (totalHari > MAX_RENTANG_BAP_HARI) {
    return {
      ok: false,
      error: `Rentang maksimal ${MAX_RENTANG_BAP_HARI} hari, yang dipilih ${totalHari} hari.`,
    };
  }

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  // Kelas + shift mana saja yang benar-benar punya musyrif ditugaskan.
  // Checkpoint dari shift yang tidak ditugaskan ke kelas itu tidak mungkin
  // pernah diisi siapa pun, jadi tidak boleh jadi baris "belum lengkap" abadi.
  const { data: gkData, error: gkError } = await supabase
    .from("guru_kelas")
    .select(
      "pegawai:pegawai(shift), kelas:kelas!inner(id, nama_kelas, jenis_kelamin, tahun_ajaran_id)",
    )
    .eq("kelas.tahun_ajaran_id", ta.id);
  if (gkError) return { ok: false, error: "Gagal membaca daftar kelas." };

  const kelasMap = new Map<string, KelasRingkas>();
  const shiftPerKelas = new Map<string, Set<number>>();
  for (const r of (gkData ?? []) as unknown as {
    pegawai: { shift: number | null } | null;
    kelas: KelasRingkas | null;
  }[]) {
    if (!r.kelas) continue;
    kelasMap.set(r.kelas.id, r.kelas);
    if (r.pegawai?.shift) {
      const set = shiftPerKelas.get(r.kelas.id) ?? new Set<number>();
      set.add(r.pegawai.shift);
      shiftPerKelas.set(r.kelas.id, set);
    }
  }

  const kelasList = [...kelasMap.values()]
    .filter((k) => {
      if (jk === "kosong") return k.jenis_kelamin === null;
      if (jk === "L" || jk === "P") return k.jenis_kelamin === jk;
      return true;
    })
    .sort((a, b) =>
      a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }),
    );
  if (kelasList.length === 0) {
    return { ok: false, error: "Tidak ada kelas yang cocok dengan filter ini." };
  }
  const kelasIds = kelasList.map((k) => k.id);

  const { data: cpData, error: cpError } = await supabase
    .from("absensi_santri_checkpoint")
    .select("id, shift, jam, urutan")
    .order("shift")
    .order("urutan");
  if (cpError) return { ok: false, error: "Gagal membaca jadwal checkpoint." };

  const checkpoints = (cpData ?? []) as {
    id: string;
    shift: number;
    jam: string;
    urutan: number;
  }[];
  const cpPerShift = new Map<number, typeof checkpoints>();
  for (const c of checkpoints) {
    const list = cpPerShift.get(c.shift) ?? [];
    list.push(c);
    cpPerShift.set(c.shift, list);
  }
  const cpById = new Map(checkpoints.map((c) => [c.id, c]));

  const [rosterRes, submisiRes, pengecualianRes, catatanRes] = await Promise.all([
    ambilSemua<{ kelas_id: string }>((from, to) =>
      supabase
        .from("santri_kelas")
        .select("kelas_id")
        .in("kelas_id", kelasIds)
        .order("santri_id")
        .range(from, to),
    ),
    ambilSemua<{
      kelas_id: string;
      checkpoint_id: string;
      tanggal: string;
      pegawai: { nama: string } | null;
    }>((from, to) =>
      supabase
        .from("absensi_santri_submission")
        .select("kelas_id, checkpoint_id, tanggal, pegawai:pegawai(nama)")
        .in("kelas_id", kelasIds)
        .gte("tanggal", dari)
        .lte("tanggal", sampai)
        .order("id")
        .range(from, to),
    ),
    ambilSemua<{
      kelas_id: string;
      checkpoint_id: string;
      tanggal: string;
      santri_id: string;
      status: "izin" | "sakit" | "alpa";
      catatan: string | null;
      santri: { nama: string; nis: string | null } | null;
    }>((from, to) =>
      supabase
        .from("absensi_santri")
        .select(
          "kelas_id, checkpoint_id, tanggal, santri_id, status, catatan, santri:santri(nama, nis)",
        )
        .in("kelas_id", kelasIds)
        .gte("tanggal", dari)
        .lte("tanggal", sampai)
        .order("id")
        .range(from, to),
    ),
    ambilSemua<{
      kelas_id: string;
      tanggal: string;
      shift: number;
      jam: string;
      isi: string;
    }>((from, to) =>
      supabase
        .from("absensi_santri_catatan")
        .select("kelas_id, tanggal, shift, jam, isi")
        .in("kelas_id", kelasIds)
        .gte("tanggal", dari)
        .lte("tanggal", sampai)
        .order("jam")
        .range(from, to),
    ),
  ]);
  if (rosterRes.gagal || submisiRes.gagal || pengecualianRes.gagal || catatanRes.gagal) {
    return { ok: false, error: "Gagal membaca data absensi." };
  }

  const rosterCount = new Map<string, number>();
  for (const r of rosterRes.rows) {
    rosterCount.set(r.kelas_id, (rosterCount.get(r.kelas_id) ?? 0) + 1);
  }

  // Semua data dikelompokkan sekali ke kunci kelas|shift|tanggal, supaya
  // perulangan di bawah tidak menjelajahi ulang seluruh larik per baris.
  const submisiPer = new Map<string, { count: number; musyrif: string | null }>();
  for (const s of submisiRes.rows) {
    const cp = cpById.get(s.checkpoint_id);
    if (!cp) continue;
    const key = `${s.kelas_id}|${cp.shift}|${s.tanggal}`;
    const cur = submisiPer.get(key) ?? { count: 0, musyrif: null };
    cur.count += 1;
    cur.musyrif = cur.musyrif ?? s.pegawai?.nama ?? null;
    submisiPer.set(key, cur);
  }

  const pengecualianPer = new Map<string, BapPengecualianRow[]>();
  for (const p of pengecualianRes.rows) {
    const cp = cpById.get(p.checkpoint_id);
    if (!cp) continue;
    const key = `${p.kelas_id}|${cp.shift}|${p.tanggal}`;
    const list = pengecualianPer.get(key) ?? [];
    list.push({
      santri_id: p.santri_id,
      nama: p.santri?.nama ?? "—",
      nis: p.santri?.nis ?? null,
      status: p.status,
      jam: cp.jam,
      urutan: cp.urutan,
      catatan: p.catatan,
    });
    pengecualianPer.set(key, list);
  }

  const catatanPer = new Map<string, { jam: string; isi: string }[]>();
  for (const c of catatanRes.rows) {
    const key = `${c.kelas_id}|${c.shift}|${c.tanggal}`;
    const list = catatanPer.get(key) ?? [];
    list.push({ jam: c.jam, isi: c.isi });
    catatanPer.set(key, list);
  }

  const rows: BapRekapRow[] = [];
  for (const tanggal of daftarTanggal(dari, sampai)) {
    for (const k of kelasList) {
      const shiftDiampu = [...(shiftPerKelas.get(k.id) ?? new Set<number>())].sort();
      for (const shift of shiftDiampu) {
        if (shiftFilter !== 0 && shift !== shiftFilter) continue;
        const cps = cpPerShift.get(shift) ?? [];
        if (cps.length === 0) continue;

        const key = `${k.id}|${shift}|${tanggal}`;
        const submisi = submisiPer.get(key);
        const data = hitungBap(
          rosterCount.get(k.id) ?? 0,
          pengecualianPer.get(key) ?? [],
        );
        const catatanList = catatanPer.get(key) ?? [];

        rows.push({
          tanggal,
          kelasId: k.id,
          kelas: k.nama_kelas,
          jenisKelamin: k.jenis_kelamin,
          shift,
          jumlahSantri: data.jumlahSantri,
          seharusnya: data.seharusnya,
          tidakHadir: data.tidakHadir,
          jamTerisi: submisi?.count ?? 0,
          jamTotal: cps.length,
          musyrif: submisi?.musyrif ?? "—",
          jamPengecekan: cps.map((c) => c.jam.slice(0, 5)),
          data,
          catatanList,
        });
      }
    }
  }

  return { ok: true, rows };
}

/**
 * BAP satu tanggal untuk semua kelas yang cocok filter — bahan PDF borongan.
 *
 * Memakai ulang `getRekapBapRentang` dengan dari = sampai, lalu menyaring
 * kelas yang jamnya belum lengkap. PDF adalah dokumen resmi yang
 * ditandatangani; menerbitkannya dari data setengah jadi tidak benar,
 * berbeda dengan Excel yang memang untuk pemantauan.
 */
export async function getBapSehari(
  tanggal: string,
  shiftFilter: number,
  jk: string,
): Promise<BapRekapResult> {
  const hasil = await getRekapBapRentang(tanggal, tanggal, shiftFilter, jk);
  if (!hasil.ok) return hasil;

  const lengkap = hasil.rows.filter((r) => r.jamTerisi >= r.jamTotal);
  if (lengkap.length === 0) {
    return {
      ok: false,
      error:
        "Tidak ada BAP yang lengkap pada tanggal & filter ini. BAP baru bisa dicetak setelah seluruh jam pengecekan terisi.",
    };
  }
  return { ok: true, rows: lengkap };
}
