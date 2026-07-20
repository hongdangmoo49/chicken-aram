import { env } from "cloudflare:workers";

export function isAdmin(email: string): boolean {
  const configured = (env as unknown as { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";
  return configured.split(",").some((entry) => entry.trim().toLowerCase() === email.toLowerCase());
}
