import { type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { formatDateID } from "@/lib/format";

type Row = {
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  is_override: boolean;
  tanggal_kejadian: string;
  catatan: string | null;
  santri: { nama: string; nis: string | null } | null;
  master_poin: { kode_poin: string; nama_poin: string } | null;
  pegawai: { nama: string } | null;
};

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile?.perms.laporan) {
    return new Response("Unauthorized", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const tipe = sp.get("tipe") ?? "";
  const taId = sp.get("ta") ?? "";
  const dateFrom = sp.get("from") ?? "";
  const dateTo = sp.get("to") ?? "";
  const q = sp.get("q") ?? "";
  const taLabel = sp.get("taLabel") ?? "export";

  const supabase = await createClient();

  let santriIds: string[] | null = null;
  if (q) {
    const t = q.replace(/[,()*]/g, " ").trim();
    if (t) {
      const { data: s } = await supabase
        .from("santri")
        .select("id")
        .or(`nama.ilike.*${t}*,nis.ilike.*${t}*`)
        .limit(200);
      santriIds = (s ?? []).map((x: { id: string }) => x.id);
      if (santriIds.length === 0)
        santriIds = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  let query = supabase
    .from("transaksi_poin")
    .select(
      "tipe, nilai_poin, is_override, tanggal_kejadian, catatan, santri:santri(nama, nis), master_poin:master_poin(kode_poin, nama_poin), pegawai:pegawai(nama)",
    )
    .order("tanggal_kejadian", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (tipe) query = query.eq("tipe", tipe);
  if (taId) query = query.eq("tahun_ajaran_id", taId);
  if (dateFrom) query = query.gte("tanggal_kejadian", dateFrom);
  if (dateTo) query = query.lte("tanggal_kejadian", dateTo);
  if (santriIds) query = query.in("santri_id", santriIds);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const excelRows = rows.map((r) => ({
    Tanggal: formatDateID(r.tanggal_kejadian),
    "Nama Santri": r.santri?.nama ?? "—",
    NIS: r.santri?.nis ?? "—",
    "Kode Poin": r.master_poin?.kode_poin ?? "—",
    "Nama Poin": r.master_poin?.nama_poin ?? "—",
    Tipe: r.tipe === "POSITIF" ? "Positif" : "Negatif",
    Nilai: r.tipe === "POSITIF" ? r.nilai_poin : -r.nilai_poin,
    Pencatat: r.pegawai?.nama ?? "—",
    Catatan: r.catatan ?? "",
    Override: r.is_override ? "Ya" : "",
  }));

  const ws = XLSX.utils.json_to_sheet(excelRows);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 25 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 10 },
    { wch: 8 },
    { wch: 20 },
    { wch: 30 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat Poin");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as number[];
  const body = new Blob([new Uint8Array(buf)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeLabel = taLabel.replace(/[^a-zA-Z0-9\-_]/g, "-");
  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="riwayat-poin-${safeLabel}.xlsx"`,
    },
  });
}
