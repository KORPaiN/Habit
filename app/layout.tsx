import type { Metadata } from "next";

import { getLocale } from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habit | Micro-habit coach",
  description: "A calm, execution-focused habit coach for tiny daily actions.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
