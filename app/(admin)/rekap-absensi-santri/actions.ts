"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canMaster, canRekapAbsensiSantri } from "@/lib/auth/dal";
import { formatDateID } from "@/lib/format";
import { dbErrorMessage, type FormResult } from "@/lib/forms";

const PATH = "/rekap-absensi-santri";

const PAGE_SIZE = 1000;
const MAX_RENTANG_HARI = 62;

export type ExportSheet = {
  sheetName: string;
  infoRows: (string | number)[][];
  rows: Record<string, unknown>[];
  colWidths: number[];
};

export type ExportRekapResult =
  | { ok: true; filename: string; sheets: ExportSheet[] }
  | { ok: false; error: string };

type KelasRingkas = {
  id: string;
  nama_kelas: string;
  jenis_kelamin: "L" | "P" | null;
};

/** Jumlah hari kalender dari `dari` sampai `sampai`, inklusif. NaN kalau formatnya salah. */
function hitungHari(dari: string, sampai: string): number {
  // Di-parse sebagai UTC supaya tidak terpengaruh zona waktu server.
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/**
 * Nama sheet yang aman untuk Excel. Kalau aturan ini dilanggar, berkasnya
 * GAGAL DIBUKA (bukan sekadar tampil jelek): maksimal 31 karakter, tidak
 * boleh mengandung : \ / ? * [ ], dan tidak boleh ada dua sheet bernama sama.
 */
function safeSheetName(nama: string, terpakai: Set<string>): string {
  const dasar = nama.replace(/[:\\/?*[\]]/g, "-").slice(0, 31).trim() || "Kelas";
  let hasil = dasar;
  let n = 2;
  while (terpakai.has(hasil)) {
    const akhiran = ` (${n})`;
    hasil = dasar.slice(0, 31 - akhiran.length) + akhiran;
    n++;
  }
  terpakai.add(hasil);
  return hasil;
}

/**
 * Ambil SEMUA baris lewat paginasi. PostgREST membatasi 1000 baris per
 * permintaan secara diam-diam — tanpa ini data terpotong tanpa pesan error.
 * Pemanggil WAJIB menyertakan `.order()` di dalam `run`, karena paginasi
 * tanpa urutan pasti bisa melewatkan/menduplikasi baris antar halaman.
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
    // Tanpa generated types, Supabase menganggap hasil embed (`santri:...`)
    // sebagai array walau relasinya satu-ke-satu — pola `as unknown as` yang
    // sama sudah dipakai di seluruh codebase ini untuk kasus itu.
    rows.push(...(batch as unknown as T[]));
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows, gagal: false };
}

export async function addCheckpoint(
  shift: number,
  jam: string,
  urutan: number,
): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("absensi_santri_checkpoint")
    .insert({ shift, jam, urutan });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi-santri");
  return { ok: true };
}

export async function deleteCheckpoint(id: string): Promise<FormResult> {
  if (!(await canMaster())) return { ok: false, error: "Tidak diizinkan." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("absensi_santri_checkpoint")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(PATH);
  revalidatePath("/absensi-santri");
  return { ok: true };
}

export async function getRekapSantriRentang(
  dari: string,
  sampai: string,
  jk: string,
): Promise<ExportRekapResult> {
  if (!(await canRekapAbsensiSantri())) {
    return { ok: false, error: "Tidak diizinkan." };
  }

  // Divalidasi ulang di server — server action bisa dipanggil langsung
  // tanpa lewat UI, jadi pemeriksaan di klien saja tidak cukup.
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
  if (totalHari > MAX_RENTANG_HARI) {
    return {
      ok: false,
      error: `Rentang maksimal ${MAX_RENTANG_HARI} hari, yang dipilih ${totalHari} hari.`,
    };
  }

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();
  if (!ta?.id) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  // Kelas yang punya musyrif ditugaskan — sumber sama dengan yang dipakai
  // halaman. Kelas tanpa musyrif tidak pernah punya catatan sama sekali.
  const { data: gkData, error: gkError } = await supabase
    .from("guru_kelas")
    .select("kelas:kelas!inner(id, nama_kelas, jenis_kelamin, tahun_ajaran_id)")
    .eq("kelas.tahun_ajaran_id", ta.id);
  if (gkError) return { ok: false, error: "Gagal membaca daftar kelas." };

  const kelasMap = new Map<string, KelasRingkas>();
  for (const r of (gkData ?? []) as unknown as { kelas: KelasRingkas | null }[]) {
    if (r.kelas) kelasMap.set(r.kelas.id, r.kelas);
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

  // Berkas xlsx tanpa satu pun sheet TIDAK VALID dan gagal dibuka — tolak
  // di sini, jangan sampai menghasilkan berkas rusak.
  if (kelasList.length === 0) {
    return { ok: false, error: "Tidak ada kelas untuk diexport pada filter ini." };
  }
  const kelasIds = kelasList.map((k) => k.id);

  const anggotaRes = await ambilSemua<{
    kelas_id: string;
    santri: { id: string; nama: string; nis: string | null } | null;
  }>((from, to) =>
    supabase
      .from("santri_kelas")
      .select("kelas_id, santri:santri(id, nama, nis)")
      .in("kelas_id", kelasIds)
      .order("santri_id")
      .range(from, to),
  );
  if (anggotaRes.gagal) {
    return { ok: false, error: "Gagal membaca anggota kelas." };
  }

  // Nama santri di-embed di sini juga (bukan cuma dari anggota kelas):
  // santri yang pindah kelas di tengah rentang sudah tidak jadi anggota
  // kelas lamanya, tapi catatannya harus tetap muncul di sheet kelas itu.
  const catatanRes = await ambilSemua<{
    kelas_id: string;
    tanggal: string;
    status: "izin" | "sakit" | "alpa";
    santri: { id: string; nama: string; nis: string | null } | null;
  }>((from, to) =>
    supabase
      .from("absensi_santri")
      .select("kelas_id, tanggal, status, santri:santri(id, nama, nis)")
      .in("kelas_id", kelasIds)
      .gte("tanggal", dari)
      .lte("tanggal", sampai)
      .order("id")
      .range(from, to),
  );
  if (catatanRes.gagal) {
    return { ok: false, error: "Gagal membaca catatan kehadiran." };
  }

  const submissionRes = await ambilSemua<{ kelas_id: string; tanggal: string }>(
    (from, to) =>
      supabase
        .from("absensi_santri_submission")
        .select("kelas_id, tanggal")
        .in("kelas_id", kelasIds)
        .gte("tanggal", dari)
        .lte("tanggal", sampai)
        .order("id")
        .range(from, to),
  );
  if (submissionRes.gagal) {
    return { ok: false, error: "Gagal membaca log pengisian absensi." };
  }

  // Hari tercatat per kelas = jumlah TANGGAL BERBEDA yang punya minimal satu
  // baris submission. Inilah yang membedakan "semua hadir" dari "tidak ada
  // yang mencatat" — keduanya sama-sama nol baris pengecualian.
  const hariTercatat = new Map<string, Set<string>>();
  for (const s of submissionRes.rows) {
    const set = hariTercatat.get(s.kelas_id) ?? new Set<string>();
    set.add(s.tanggal);
    hariTercatat.set(s.kelas_id, set);
  }

  type SantriAgg = {
    nama: string;
    nis: string | null;
    izin: Set<string>;
    sakit: Set<string>;
    alpa: Set<string>;
  };
  const perKelas = new Map<string, Map<string, SantriAgg>>();
  for (const id of kelasIds) perKelas.set(id, new Map());

  function ambilAgg(
    kelasId: string,
    santri: { id: string; nama: string; nis: string | null },
  ): SantriAgg {
    const m = perKelas.get(kelasId)!;
    const ada = m.get(santri.id);
    if (ada) return ada;
    const baru: SantriAgg = {
      nama: santri.nama,
      nis: santri.nis,
      izin: new Set(),
      sakit: new Set(),
      alpa: new Set(),
    };
    m.set(santri.id, baru);
    return baru;
  }

  for (const a of anggotaRes.rows) {
    if (a.santri && perKelas.has(a.kelas_id)) ambilAgg(a.kelas_id, a.santri);
  }
  // Menyimpan HIMPUNAN TANGGAL, bukan menambah penghitung — supaya santri
  // yang izin di 6 checkpoint pada tanggal sama tetap terhitung 1 hari.
  for (const c of catatanRes.rows) {
    if (!c.santri || !perKelas.has(c.kelas_id)) continue;
    const agg = ambilAgg(c.kelas_id, c.santri);
    agg[c.status].add(c.tanggal);
  }

  const terpakai = new Set<string>();
  const sheets: ExportSheet[] = kelasList.map((k) => {
    const daftar = [...(perKelas.get(k.id)?.values() ?? [])].sort((a, b) =>
      a.nama.localeCompare(b.nama),
    );
    const rows: Record<string, unknown>[] =
      daftar.length > 0
        ? daftar.map((s, i) => ({
            No: i + 1,
            "Nama Santri": s.nama,
            NIS: s.nis ?? "—",
            Izin: s.izin.size,
            Sakit: s.sakit.size,
            Alpa: s.alpa.size,
            Total: s.izin.size + s.sakit.size + s.alpa.size,
          }))
        : [
            {
              No: "",
              "Nama Santri": "Belum ada santri di kelas ini.",
              NIS: "",
              Izin: "",
              Sakit: "",
              Alpa: "",
              Total: "",
            },
          ];

    return {
      sheetName: safeSheetName(k.nama_kelas, terpakai),
      infoRows: [
        ["Kelas", k.nama_kelas],
        [
          "Jenis Kelamin",
          k.jenis_kelamin === "L" ? "Putra" : k.jenis_kelamin === "P" ? "Putri" : "—",
        ],
        ["Rentang", `${formatDateID(dari)} - ${formatDateID(sampai)}`],
        [
          "Hari tercatat",
          `${hariTercatat.get(k.id)?.size ?? 0} dari ${totalHari} hari`,
        ],
        [],
      ],
      rows,
      colWidths: [5, 28, 14, 8, 8, 8, 8],
    };
  });

  return {
    ok: true,
    filename: `rekap-absensi-santri-${dari}-sd-${sampai}.xlsx`,
    sheets,
  };
}
