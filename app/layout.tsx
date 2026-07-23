import type { Metadata } from "next";
import { Suspense } from "react";
import { siteUrl } from "../lib/site-url";
import "./globals.css";
import { Toast } from "./toast";

export function generateMetadata(): Metadata {
  const title = "치킨 증바람";
  const description = "증강 칼바람 내전의 대전 일정, 결과, 선수 티어를 기록하는 공식 보드";
  const image = `${siteUrl}/og.png`;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { title, description, type: "website", url: siteUrl, images: [{ url: image, width: 1736, height: 907 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><Suspense><Toast /></Suspense>{children}</body>
    </html>
  );
}
