import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Career Tracker",
    template: "%s | Career Tracker",
  },
  description: "로컬에서 안전하게 살펴보는 채용공고와 지원 현황",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <p>지원 자료는 이 기기 안에서 읽기 전용으로 다룹니다.</p>
        </footer>
      </body>
    </html>
  );
}
