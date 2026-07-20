export type EditableRole = "user" | "admin";

export type MemberRoleChange = {
  userId: string;
  role: EditableRole;
};

export function normalizeMemberRoleChanges(value: unknown): MemberRoleChange[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const changes = new Map<string, EditableRole>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const userId = String((item as Record<string, unknown>).userId ?? "");
    const role = String((item as Record<string, unknown>).role ?? "");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) || (role !== "user" && role !== "admin")) return null;
    changes.set(userId, role);
  }
  return [...changes].map(([userId, role]) => ({ userId, role }));
}
