import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("reports handled and unhandled server errors with traceable IDs", async () => {
  const [instrumentation, observability, errorPage] = await Promise.all([
    readFile(new URL("instrumentation.ts", root), "utf8"),
    readFile(new URL("lib/observability.ts", root), "utf8"),
    readFile(new URL("app/error.tsx", root), "utf8"),
  ]);

  assert.match(instrumentation, /registerOTel\(\{ serviceName: "chicken-aram" \}\)/);
  assert.match(instrumentation, /onRequestError/);
  assert.match(observability, /crypto\.randomUUID\(\)/);
  assert.match(observability, /event: "app_error"/);
  assert.match(errorPage, /오류 번호/);
  assert.match(errorPage, /다시 시도/);
});
