import { BookMarked } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      icon={BookMarked}
      title="Hafalan"
      description="Catatan hafalan mutun dan tahfidz sedang dalam tahap pengembangan. Insyaallah segera hadir di sini."
    />
  );
}
