import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "connect-src 'self' https://api.stripe.com https://*.stripe.com https://vpic.nhtsa.dot.gov",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://billing.stripe.com https://checkout.stripe.com",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  ].join("; ");
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return response;
}

function sameOriginApiMutation(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith("/api/")) return true;
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export default auth((request) => {
  if (!sameOriginApiMutation(request)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
    );
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  // Run auth and security headers for app and API routes; skip static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$).*)",
  ],
};
