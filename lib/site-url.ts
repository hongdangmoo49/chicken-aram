export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://chicken-aram.vercel.app")
).replace(/\/$/, "");
