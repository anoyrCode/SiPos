import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIPOS — Sistem Informasi Poin Santri",
  description:
    "Aplikasi pencatatan dan monitoring poin positif & negatif santri pesantren.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SIPOS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0092B7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
        <ThemeProvider>
          {children}
          <Toaster richColors position="bottom-right" />
          <PwaInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
