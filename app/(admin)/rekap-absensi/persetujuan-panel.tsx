import { CheckCircle, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateID } from "@/lib/format";
import { totalPages } from "@/lib/list-params";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PENGAJUAN_STATUS_LABEL, type PengajuanStatus } from "@/lib/absensi-status";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { setujuiPengajuan } from "./actions";
import { TolakDialog } from "./tolak-dialog";

type Row = {
  id: string;
  nama: string;
  kategori: "izin" | "sakit";
  tanggalMulai: string;
  tanggalSelesai: string;
  keterangan: string | null;
  status: PengajuanStatus;
  buktiUrl: string | null;
};

const KATEGORI_LABEL: Record<Row["kategori"], string> = {
  izin: "Izin",
  sakit: "Sakit",
};

const STATUS_VARIANT: Record<PengajuanStatus, "warning" | "positive" | "negative"> = {
  menunggu: "warning",
  disetujui: "positive",
  ditolak: "negative",
};

export async function PersetujuanPanel({
  statusFilter,
  page,
  perPage,
}: {
  statusFilter: PengajuanStatus;
  page: number;
  perPage: number;
}) {
  const supabase = await createClient();
  const from = (page - 1) * perPage;
  const { data, count } = await supabase
    .from("absensi_pengajuan")
    .select(
      "id, kategori, tanggal_mulai, tanggal_selesai, keterangan, status, bukti_url, pegawai:pegawai(nama)",
      { count: "exact" },
    )
    .eq("status", statusFilter)
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  type PegawaiEmbed = { nama: string } | { nama: string }[] | null;
  const embedNama = (e: PegawaiEmbed): string =>
    e ? (Array.isArray(e) ? (e[0]?.nama ?? "—") : e.nama) : "—";

  const rowsRaw = (data ?? []) as unknown as {
    id: string;
    kategori: Row["kategori"];
    tanggal_mulai: string;
    tanggal_selesai: string;
    keterangan: string | null;
    status: PengajuanStatus;
    bukti_url: string | null;
    pegawai: PegawaiEmbed;
  }[];

  const buktiUrlMap = new Map<string, string>();
  for (const r of rowsRaw) {
    if (!r.bukti_url) continue;
    const { data: signed } = await supabase.storage
      .from("bukti-absensi")
      .createSignedUrl(r.bukti_url, 300);
    if (signed?.signedUrl) buktiUrlMap.set(r.id, signed.signedUrl);
  }

  const rows: Row[] = rowsRaw.map((r) => ({
    id: r.id,
    nama: embedNama(r.pegawai),
    kategori: r.kategori,
    tanggalMulai: r.tanggal_mulai,
    tanggalSelesai: r.tanggal_selesai,
    keterangan: r.keterangan,
    status: r.status,
    buktiUrl: buktiUrlMap.get(r.id) ?? null,
  }));

  const columns: Column<Row>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "kategori",
      header: "Kategori",
      cell: (r) => <Badge variant="outline">{KATEGORI_LABEL[r.kategori]}</Badge>,
    },
    {
      key: "tanggal",
      header: "Tanggal",
      cell: (r) =>
        r.tanggalMulai === r.tanggalSelesai
          ? formatDateID(r.tanggalMulai)
          : `${formatDateID(r.tanggalMulai)} – ${formatDateID(r.tanggalSelesai)}`,
    },
    {
      key: "keterangan",
      header: "Keterangan",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">{r.keterangan ?? "—"}</span>
      ),
    },
    {
      key: "bukti",
      header: "Bukti",
      cell: (r) =>
        r.buktiUrl ? (
          <a
            href={r.buktiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <FileText className="size-3.5" />
            Lihat
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>{PENGAJUAN_STATUS_LABEL[r.status]}</Badge>
      ),
    },
    ...(statusFilter === "menunggu"
      ? [
          {
            key: "aksi",
            header: <span className="sr-only">Aksi</span>,
            headClassName: "text-right",
            className: "text-right",
            cell: (r: Row) => (
              <div className="flex justify-end gap-2">
                <ConfirmDialog
                  action={setujuiPengajuan}
                  id={r.id}
                  title="Setujui pengajuan?"
                  description={`Pengajuan ${KATEGORI_LABEL[r.kategori]} milik "${r.nama}" akan disetujui.`}
                  confirmLabel="Setujui"
                  successMessage="Pengajuan disetujui."
                  trigger={
                    <Button type="button" size="sm">
                      <CheckCircle data-icon="inline-start" />
                      Setujui
                    </Button>
                  }
                />
                <TolakDialog id={r.id} />
              </div>
            ),
          } satisfies Column<Row>,
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={false}
        empty={
          statusFilter === "menunggu"
            ? "Tidak ada pengajuan yang menunggu persetujuan."
            : "Belum ada riwayat."
        }
      />
      <Pagination
        page={page}
        perPage={perPage}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
