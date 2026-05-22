import { PoinPage } from "../_poin/poin-page";
import type { SearchParams } from "@/lib/list-params";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PoinPage tipe="POSITIF" searchParams={searchParams} />;
}
