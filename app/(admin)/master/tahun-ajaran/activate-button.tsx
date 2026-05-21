"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { setTahunAjaranAktif } from "./actions";

export function ActivateButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      title={error ?? undefined}
      onClick={() =>
        startTransition(async () => {
          const res = await setTahunAjaranAktif(id);
          if (!res.ok) setError(res.error);
          else router.refresh();
        })
      }
    >
      {pending ? "…" : "Aktifkan"}
    </Button>
  );
}
