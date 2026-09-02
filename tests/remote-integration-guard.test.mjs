import assert from "node:assert/strict";
import test from "node:test";
import { remoteIntegrationTarget } from "./integration/remote-test-guard.mjs";

const credentials = { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable", SUPABASE_SERVICE_ROLE_KEY: "secret", ALLOW_REMOTE_INTEGRATION_TESTS: "true" };

test("never runs write integration tests against production", () => {
  assert.equal(remoteIntegrationTarget({ ...credentials, NEXT_PUBLIC_SUPABASE_URL: "https://fckuqfwisgljegewgxoc.supabase.co", SUPABASE_TEST_PROJECT_REF: "fckuqfwisgljegewgxoc" }).allowed, false);
  assert.equal(remoteIntegrationTarget({ ...credentials, NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co", SUPABASE_TEST_PROJECT_REF: "testproject" }).allowed, true);
  assert.equal(remoteIntegrationTarget({ ...credentials, NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co", SUPABASE_TEST_PROJECT_REF: "different" }).allowed, false);
});
