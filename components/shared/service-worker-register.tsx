"use client";

import { useEffect } from "react";

/**
 * Daftarkan service worker via useEffect, BUKAN <script> mentah di JSX.
 * React 19 menghoist elemen <script>/<style>/<link> lewat sistem resource-nya
 * sendiri — kalau ditulis sebagai anak biasa, posisinya bisa dicocokkan beda
 * antara server-render dan hydration, memicu hydration mismatch persis di
 * area <Head>/MetadataWrapper.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js");
    });
  }, []);

  return null;
}
