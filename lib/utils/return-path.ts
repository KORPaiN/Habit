const DEFAULT_RETURN_PATH = "/onboarding";

export function sanitizeReturnPath(value?: string | null, fallback = DEFAULT_RETURN_PATH) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAnchorsPath(options?: {
  returnTo?: string | null;
  saved?: boolean;
  deleted?: boolean;
  error?: string | null;
}) {
  const search = new URLSearchParams();
  const returnTo = sanitizeReturnPath(options?.returnTo);

  if (returnTo !== DEFAULT_RETURN_PATH) {
    search.set("returnTo", returnTo);
  }

  if (options?.saved) {
    search.set("saved", "1");
  }

  if (options?.deleted) {
    search.set("deleted", "1");
  }

  if (options?.error) {
    search.set("error", options.error);
  }

  const query = search.toString();
  return query ? `/anchors?${query}` : "/anchors";
}
