import { NextResponse } from "next/server";
import { withToast, type ToastType } from "./toast";

export function redirectWithToast(request: Request, path: string, type: ToastType, message: string) {
  return NextResponse.redirect(new URL(withToast(path, type, message), request.url), 303);
}
