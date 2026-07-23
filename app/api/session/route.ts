import { getCurrentUser } from "../../auth";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json(user ? {
    displayName: user.displayName,
    thumbnailKey: user.thumbnailKey,
    role: user.role,
  } : null, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
