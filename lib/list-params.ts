export const DEFAULT_PER_PAGE = 10;

export type SearchParams = Record<string, string | string[] | undefined>;

export function getStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export type ListParams = {
  page: number;
  perPage: number;
  q: string;
  from: number;
  to: number;
};

export function parseListParams(
  searchParams: SearchParams,
  perPage = DEFAULT_PER_PAGE,
): ListParams {
  const pageRaw = Number(getStr(searchParams.page));
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const q = getStr(searchParams.q).trim();
  const from = (page - 1) * perPage;
  return { page, perPage, q, from, to: from + perPage - 1 };
}

export function totalPages(count: number | null, perPage: number): number {
  return Math.max(1, Math.ceil((count ?? 0) / perPage));
}
