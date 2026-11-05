import type { Metadata } from "next";
import { instrumentSerif, inter, jetbrains } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QASyn — Autonomous AI quality engineering", template: "%s · QASyn" },
  description: "Autonomous AI quality engineering — local prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
