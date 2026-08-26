import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { withToast } from "../lib/toast.ts";

test("adds a toast without dropping existing query parameters", () => {
  assert.equal(
    withToast("/login?returnTo=%2Fprofile", "error", "로그인이 필요합니다."),
    "/login?returnTo=%2Fprofile&toast=%EB%A1%9C%EA%B7%B8%EC%9D%B8%EC%9D%B4+%ED%95%84%EC%9A%94%ED%95%A9%EB%8B%88%EB%8B%A4.&toastType=error",
  );
});

test("hides the toast immediately before cleaning the URL", async () => {
  const component = await readFile(new URL("../app/toast.tsx", import.meta.url), "utf8");
  assert.match(component, /setVisible\(false\)/);
  assert.match(component, /if \(!visible\) return null/);
  assert.match(component, /window\.history\.replaceState/);
});
