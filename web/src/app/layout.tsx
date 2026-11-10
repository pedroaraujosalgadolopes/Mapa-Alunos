import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { cssVars } from "@/lib/tokens";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("titulo") };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
