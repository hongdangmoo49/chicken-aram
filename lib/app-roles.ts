export type AppRole = "user" | "admin" | "super_admin";

export const roleLabels: Record<AppRole, string> = {
  user: "일반 사용자",
  admin: "관리자",
  super_admin: "슈퍼 관리자",
};
