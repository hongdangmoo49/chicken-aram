export type ToastType = "success" | "error";

export function withToast(path: string, type: ToastType, message: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("toast", message);
  url.searchParams.set("toastType", type);
  return `${url.pathname}${url.search}${url.hash}`;
}
