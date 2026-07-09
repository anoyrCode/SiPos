"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-heading text-5xl font-bold text-negative">Oops</p>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">
          Ada masalah saat memuat halaman ini. Coba lagi, atau kembali ke beranda.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Coba Lagi
        </Button>
        <Button asChild>
          <Link href="/">Kembali ke beranda</Link>
        </Button>
      </div>
    </main>
  );
}
