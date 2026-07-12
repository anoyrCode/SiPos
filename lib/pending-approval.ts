import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Jumlah pengajuan izin/sakit/cuti yang masih "menunggu" — utk badge nav. */
export async function getPendingApprovalCount(canSeeApproval: boolean): Promise<number> {
  if (!canSeeApproval) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("absensi_pengajuan")
    .select("id", { count: "exact", head: true })
    .eq("status", "menunggu");
  return count ?? 0;
}
