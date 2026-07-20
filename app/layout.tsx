import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${protocol}://${host}`;
  const title = "치킨 증바람";
  const description = "증강 칼바람 내전의 대전 일정, 결과, 선수 티어를 기록하는 공식 보드";
  const image = `${url}/og.png`;
  return {
    metadataBase: new URL(url),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { title, description, type: "website", url, images: [{ url: image, width: 1736, height: 907 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
