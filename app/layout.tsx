import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Habit | Micro-habit coach",
  description: "A calm, execution-focused habit coach for tiny daily actions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
