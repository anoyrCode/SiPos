import Image from "next/image";

import { cn } from "@/lib/utils";

/** Logo SIPOS (perisai) dari /public/logo.png. */
export function SiposMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block size-9 shrink-0", className)}
      aria-hidden
    >
      <Image
        src="/logo.png"
        alt=""
        fill
        sizes="48px"
        className="object-contain"
        priority
      />
    </span>
  );
}
