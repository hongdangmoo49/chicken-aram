import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses a fixed canonical origin and secure response headers", async () => {
  const [config, layout, redirects] = await Promise.all([
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("lib/toast-response.ts", root), "utf8"),
  ]);
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.match(config, new RegExp(header));
  }
  assert.doesNotMatch(layout, /x-forwarded-host|headers\(\)/);
  assert.match(layout, /metadataBase: new URL\(siteUrl\)/);
  assert.match(redirects, /new URL\(withToast\(path, type, message\), siteUrl\)/);
});
