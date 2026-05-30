"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateWaliFromSantri } from "./actions";

export function GenerateWaliButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          setErr(null);
          startTransition(async () => {
            const r = await generateWaliFromSantri();
            if (r.ok) {
              setMsg(r.message);
              router.refresh();
            } else {
              setErr(r.error);
            }
          });
        }}
      >
        <RefreshCw data-icon="inline-start" />
        {pending ? "Memproses…" : "Generate dari Data Santri"}
      </Button>
      {msg && <span className="text-xs text-positive">{msg}</span>}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
