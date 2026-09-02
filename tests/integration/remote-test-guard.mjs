const productionProjectRef = "fckuqfwisgljegewgxoc";

export function remoteIntegrationTarget(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const configured = Boolean(url && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  let projectRef = "";
  try { projectRef = url ? new URL(url).hostname.split(".")[0] : ""; } catch { /* invalid URL */ }
  const allowed = env.ALLOW_REMOTE_INTEGRATION_TESTS === "true"
    && Boolean(env.SUPABASE_TEST_PROJECT_REF)
    && env.SUPABASE_TEST_PROJECT_REF === projectRef
    && projectRef !== productionProjectRef;
  return { configured, allowed, projectRef };
}
