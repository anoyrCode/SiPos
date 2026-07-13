export const DEFAULT_PER_PAGE = 10;
export const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;

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
  defaultPerPage = DEFAULT_PER_PAGE,
): ListParams {
  const pageRaw = Number(getStr(searchParams.page));
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const perPageRaw = Number(getStr(searchParams.perPage));
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : defaultPerPage;
  const q = getStr(searchParams.q).trim();
  const from = (page - 1) * perPage;
  return { page, perPage, q, from, to: from + perPage - 1 };
}

export function totalPages(count: number | null, perPage: number): number {
  return Math.max(1, Math.ceil((count ?? 0) / perPage));
}

export type PageParams = { page: number; perPage: number; from: number; to: number };

/**
 * Page/perPage dari param custom (server component) — utk halaman dgn >1
 * tabel independen yg tiap tabel butuh nama query param sendiri
 * (mis. "masukPage" vs "keluarPage").
 */
export function parsePageParamsNamed(
  searchParams: SearchParams,
  pageParam: string,
  perPageParam: string,
): PageParams {
  const pageRaw = Number(getStr(searchParams[pageParam]));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const perPageRaw = Number(getStr(searchParams[perPageParam]));
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : DEFAULT_PER_PAGE;
  const from = (page - 1) * perPage;
  return { page, perPage, from, to: from + perPage - 1 };
}

/**
 * Page/perPage dari `useSearchParams()` client component — utk tabel yg
 * datanya sudah di-fetch penuh & difilter di browser (bukan server-paginated).
 */
export function parseClientPageParams(
  searchParams: { get(key: string): string | null },
  pageParam = "page",
  perPageParam = "perPage",
): { page: number; perPage: number } {
  const pageRaw = Number(searchParams.get(pageParam));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const perPageRaw = Number(searchParams.get(perPageParam));
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : DEFAULT_PER_PAGE;
  return { page, perPage };
}

export type Paginated<T> = {
  rows: T[];
  page: number;
  totalPages: number;
  totalItems: number;
};

/** Potong array jadi 1 halaman — dipakai utk tabel yg datanya sudah lengkap di memori (client atau server). */
export function paginateArray<T>(
  rows: T[],
  page: number,
  perPage: number,
): Paginated<T> {
  const totalItems = rows.length;
  const pages = totalPages(totalItems, perPage);
  const clampedPage = Math.min(Math.max(page, 1), pages);
  const start = (clampedPage - 1) * perPage;
  return {
    rows: rows.slice(start, start + perPage),
    page: clampedPage,
    totalPages: pages,
    totalItems,
  };
}
