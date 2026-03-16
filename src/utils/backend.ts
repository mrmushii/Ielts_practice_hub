const defaultBackendUrl = "http://localhost:8000";

function normalizeBackendBaseUrl(rawValue?: string): string {
  const trimmed = rawValue?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!trimmed) return defaultBackendUrl;

  // Accept host-only values and normalize accidental leading slashes.
  // Example malformed values handled here:
  // - ieltspracticehubbackend-production.up.railway.app
  // - /ieltspracticehubbackend-production.up.railway.app
  let candidate = trimmed;
  if (/^\/+/.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^\/+/, "");
  }

  // If protocol is missing, default to HTTPS for cloud deployments.
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return defaultBackendUrl;
    return parsed.origin;
  } catch {
    return defaultBackendUrl;
  }
}

const configuredBackendUrl = normalizeBackendBaseUrl(
  process.env.NEXT_PUBLIC_BACKEND_API_URL
);

export const BACKEND_BASE_URL = configuredBackendUrl.replace(/\/+$/, "");

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalizedPath}`;
}
