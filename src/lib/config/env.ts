const LOCALHOST_FALLBACK = "http://localhost:3000";

function cleanUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getAppUrlFromEnv(): string {
  return (
    cleanUrl(process.env.APP_URL) ||
    cleanUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    cleanUrl(process.env.NEXTAUTH_URL) ||
    LOCALHOST_FALLBACK
  );
}

export function getAppUrlFromRequestHost(hostHeader?: string | null, protocolHeader?: string | null): string {
  const host = hostHeader?.trim();
  if (!host) return getAppUrlFromEnv();

  const protocol = protocolHeader?.split(",")[0]?.trim() || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function requireServerEnv(varName: string): string {
  const value = process.env[varName];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
  return value.trim();
}

export function optionalServerEnv(varName: string): string | undefined {
  const value = process.env[varName];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}
