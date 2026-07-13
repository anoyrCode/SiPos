import { UserCog } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { phoneToWaliEmail } from "@/lib/auth/phone";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { GenerateWaliButton } from "./generate-button";
import { WaliAccountActions } from "./account-actions";
import { WaliAnakDialog } from "./anak-dialog";

type WaliRow = {
  id: string;
  nama: string | null;
  no_telp: string;
  user_id: string | null;
  anak: { count: number }[];
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("akun");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("wali")
    .select("id, nama, no_telp, user_id, anak:wali_santri(count)", {
      count: "exact",
    })
    .order("nama");
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`nama.ilike.*${term}*,no_telp.ilike.*${term}*`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as WaliRow[];

  const columns: Column<WaliRow>[] = [
    {
      key: "nama",
      header: "Nama Wali",
      cell: (r) => <span className="font-medium">{r.nama ?? "—"}</span>,
    },
    {
      key: "no_telp",
      header: "No Telp (username)",
      cell: (r) => <span className="font-mono text-xs">{r.no_telp}</span>,
    },
    {
      key: "anak",
      header: "Anak",
      cell: (r) => <WaliAnakDialog waliId={r.id} count={r.anak?.[0]?.count ?? 0} />,
    },
    {
      key: "status",
      header: "Status Akun",
      cell: (r) =>
        r.user_id ? (
          <Badge variant="positive">Aktif</Badge>
        ) : (
          <Badge variant="outline">Belum dibuat</Badge>
        ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <WaliAccountActions
          waliId={r.id}
          waliNama={r.nama ?? r.no_telp}
          hasAccount={Boolean(r.user_id)}
          email={phoneToWaliEmail(r.no_telp)}
        />
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={UserCog}
        title="Manajemen Akun Wali"
        description="Akun wali login pakai no WA/telp. Satu nomor bisa terhubung ke beberapa santri."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama atau no telp…" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <GenerateWaliButton />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada akun wali."
        emptyHint={`Gunakan tombol "Generate dari Data Santri" untuk membuat akun wali.`}
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
