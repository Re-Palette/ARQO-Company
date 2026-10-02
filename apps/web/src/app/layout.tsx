import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F.R.I.D.A.Y. — AI COMPANY OS",
  description: "AI社員が働く、CEOのための経営OS",
};

export const viewport: Viewport = { themeColor: "#070b14" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased dark">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
