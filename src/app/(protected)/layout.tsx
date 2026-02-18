import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LogOut, Radar, User, LayoutDashboard, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/logout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const shop = await prisma.shop.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  });
  if (!shop) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 shadow-sm">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">ADAS Intelligence</p>
              <p className="hidden md:block text-[11px] text-slate-500 -mt-0.5">Estimate calibration decision portal</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-cyan-50 hover:text-cyan-700">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/scrub">
              <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-cyan-50 hover:text-cyan-700">
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Scrub Estimate
              </Button>
            </Link>
          </nav>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200">
                <User className="w-4 h-4 text-cyan-700" />
              </div>
              <div className="hidden sm:block">
                <p className="font-medium text-slate-900">{shop.name}</p>
                <p className="text-xs text-slate-500">{shop.email}</p>
              </div>
            </div>
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
