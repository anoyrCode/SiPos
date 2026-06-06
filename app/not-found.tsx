import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-heading text-5xl font-bold text-primary">404</p>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
