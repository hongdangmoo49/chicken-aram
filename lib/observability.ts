type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export function reportError(scope: string, error: unknown, context: ErrorContext = {}) {
  const errorId = crypto.randomUUID();
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);

  console.error(JSON.stringify({
    level: "error",
    event: "app_error",
    errorId,
    scope,
    message,
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }));
  return errorId;
}
