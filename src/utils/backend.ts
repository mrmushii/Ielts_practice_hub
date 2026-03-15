const defaultBackendUrl = "http://localhost:8000";

const configuredBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || defaultBackendUrl;

export const BACKEND_BASE_URL = configuredBackendUrl.replace(/\/+$/, "");

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalizedPath}`;
}
