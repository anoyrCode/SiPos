import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Header internal (request-only, tidak pernah dikirim ke client) yang membawa
 * hasil verifikasi `supabase.auth.getUser()` dari proxy ke seluruh Server
 * Component/Action pada request yang sama — supaya `getUser()` di `dal.ts`
 * tidak perlu memanggil ulang Supabase Auth (hemat 1 round-trip per request).
 * String kosong = proxy sudah cek dan user belum login (bukan "tidak diketahui").
 */
export const USER_ID_HEADER = "x-sipos-uid";

/**
 * Refresh sesi Supabase pada setiap request, dipanggil dari `proxy.ts`.
 * Mengembalikan `response` yang sudah membawa cookie sesi terbaru, beserta
 * `user` hasil verifikasi (atau null bila belum login).
 *
 * Catatan: jangan menyisipkan logika di antara `createServerClient` dan
 * `supabase.auth.getUser()` agar refresh sesi tidak terganggu.
 */
export async function updateSession(request: NextRequest) {
  let pendingCookies: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          pendingCookies = cookiesToSet;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Teruskan hasil verifikasi ke request upstream (bukan ke client — lihat
  // docs/next/backend-for-frontend.md soal `NextResponse.next({request:{headers}})`).
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(USER_ID_HEADER, user?.id ?? "");

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );

  return { response, user };
}
