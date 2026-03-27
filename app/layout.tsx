import type { Metadata } from "next";

import { getLocale } from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habit | 마이크로 습관 코치",
  description: "큰 목표를 오늘 가능한 아주 작은 행동으로 바꿔 주는 차분한 습관 코치입니다.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
