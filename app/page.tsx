import { redirect } from "next/navigation";

import { getProfile } from "@/lib/auth/dal";
import { homePathForProfile } from "@/lib/auth/roles";

// Router beranda: arahkan ke halaman sesuai hak akses (atau /login bila belum masuk).
export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(homePathForProfile(profile));
}
