"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/login";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Radar } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined
  );

  return (
    <div className="space-y-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Radar className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your shop account to continue
          </p>
        </div>
      </div>

      {/* Login Form */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-xl shadow-black/5">
        <CardContent className="pt-6">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/15 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="shop@example.com"
                required
                disabled={isPending}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isPending}
                className="bg-background/50"
              />
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don&apos;t have an account? </span>
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Register your shop
            </Link>
          </div>
        </CardContent>
      </Card>

      {process.env.NODE_ENV !== "production" ? (
        <div className="text-center text-xs text-muted-foreground">
          <p>Demo: demo@test.com / demo123</p>
        </div>
      ) : null}
    </div>
  );
}
