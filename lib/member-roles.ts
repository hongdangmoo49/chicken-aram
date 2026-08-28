import type { AppRole } from "./app-roles";

export type EditableRole = "user" | "admin";

export type MemberRoleChange = {
  userId: string;
  role: EditableRole;
};

const userIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isMemberUserId(value: string) {
  return userIdPattern.test(value);
}

export function matchesMemberSearch(member: { displayName: string; email: string | null; telegram: { username: string | null } | null }, query: string) {
  const keyword = query.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  if (!keyword) return true;
  const username = member.telegram?.username;
  return [member.displayName, member.email, username, username ? `@${username}` : null].some((value) => value?.normalize("NFKC").toLocaleLowerCase("ko-KR").includes(keyword));
}

export function validateMemberAccountDeletion(input: {
  actorId: string;
  targetId: string;
  targetRole: AppRole;
  targetEmail: string | null;
  confirmationEmail: string;
}) {
  if (input.actorId === input.targetId) return "self";
  if (input.targetRole === "super_admin") return "protected";
  if (!input.targetEmail || input.targetEmail.toLowerCase() !== input.confirmationEmail.trim().toLowerCase()) return "email";
  return null;
}

export function normalizeMemberRoleChanges(value: unknown): MemberRoleChange[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const changes = new Map<string, EditableRole>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const userId = String((item as Record<string, unknown>).userId ?? "");
    const role = String((item as Record<string, unknown>).role ?? "");
    if (!isMemberUserId(userId) || (role !== "user" && role !== "admin")) return null;
    changes.set(userId, role);
  }
  return [...changes].map(([userId, role]) => ({ userId, role }));
}
