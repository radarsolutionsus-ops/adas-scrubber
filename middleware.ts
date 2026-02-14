import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Protect dashboard and scrub routes, skip static files and API routes
  matcher: [
    "/dashboard/:path*",
    "/scrub/:path*",
    "/login",
    "/signup",
  ],
};
