import { NextResponse } from "next/server";
import { siteUrl } from "./site-url";
import { withToast, type ToastType } from "./toast";

export function redirectWithToast(request: Request, path: string, type: ToastType, message: string) {
  void request;
  return NextResponse.redirect(new URL(withToast(path, type, message), siteUrl), 303);
}
