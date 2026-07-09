"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const CS_WHATSAPP_NUMBER = "62895329572147";
/** Lama tampil dalam bentuk lebar (ikon + teks) sebelum menciut jadi ikon saja. */
const EXPANDED_MS = 4000;

export function WhatsappFab({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setExpanded(false), EXPANDED_MS);
    return () => clearTimeout(id);
  }, []);

  const message = encodeURIComponent(
    `Halo, saya ${name}, ada kendala terkait akun SIPOS.`,
  );

  return (
    <Link
      href={`https://wa.me/${CS_WHATSAPP_NUMBER}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi CS via WhatsApp"
      onMouseEnter={() => setExpanded(true)}
      className={cn(
        "animate-enter fixed bottom-5 right-5 z-40 flex items-center overflow-hidden bg-[#25D366] py-2.5 pl-2.5 text-white shadow-lg shadow-black/25 transition-all duration-300 hover:scale-[1.03] active:scale-95",
        expanded ? "gap-3 rounded-2xl pr-4" : "gap-0 rounded-full pr-2.5",
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <span
          aria-hidden
          className="absolute inline-flex size-full animate-ping rounded-full bg-white/30"
        />
        <MessageCircle className="relative size-5" />
      </span>
      <span
        className={cn(
          "flex flex-col justify-center overflow-hidden leading-tight transition-[max-width,opacity] duration-300",
          expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        <span className="whitespace-nowrap text-sm font-semibold">
          Hubungi CS
        </span>
        <span className="whitespace-nowrap text-[0.7rem] text-white/85">
          Ada kendala? Chat di sini
        </span>
      </span>
    </Link>
  );
}
