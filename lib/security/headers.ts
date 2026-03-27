const CONNECT_SRC = ["'self'", "https://*.supabase.co", "wss://*.supabase.co"];
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

function buildContentSecurityPolicy() {
  return [
    "default-src 'self'",
    `script-src ${SCRIPT_SRC.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    `connect-src ${CONNECT_SRC.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function getSecurityHeaders() {
  const headers = new Headers();

  headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return headers;
}

export function applySecurityHeaders(response: Response) {
  const headers = getSecurityHeaders();

  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}
