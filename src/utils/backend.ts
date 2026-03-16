const defaultBackendUrl = "http://localhost:8000";

function normalizeBackendBaseUrl(rawValue?: string): string {
  const trimmed = rawValue?.trim();
  if (!trimmed) return defaultBackendUrl;

  // If protocol is missing (for example: my-api.up.railway.app),
  // default to HTTPS for production hosting platforms.
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

const configuredBackendUrl = normalizeBackendBaseUrl(
  process.env.NEXT_PUBLIC_BACKEND_API_URL
);

export const BACKEND_BASE_URL = configuredBackendUrl.replace(/\/+$/, "");

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalizedPath}`;
}
