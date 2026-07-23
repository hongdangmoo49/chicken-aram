import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";
import { reportError } from "./lib/observability";

export function register() {
  registerOTel({ serviceName: "chicken-aram" });
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportError("next.request", error, {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    digest: error && typeof error === "object" && "digest" in error ? String(error.digest) : undefined,
  });
};
