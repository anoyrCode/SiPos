import { ClipboardList } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Penilaian"
      description="Nilai pembelajaran dan absensi mata pelajaran sedang dalam tahap pengembangan. Insyaallah segera hadir di sini."
    />
  );
}
