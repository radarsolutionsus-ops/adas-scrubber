"use client";

import { useActionState } from "react";
import { register, type RegisterState } from "@/actions/register";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Radar } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState<RegisterState | undefined, FormData>(
    register,
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
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Start scrubbing estimates in seconds
          </p>
        </div>
      </div>

      {/* Signup Form */}
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
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                name="shopName"
                placeholder="e.g. Precision Auto Body"
                required
                disabled={isPending}
                className="bg-background/50"
              />
            </div>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a strong password"
                required
                minLength={8}
                disabled={isPending}
                className="bg-background/50"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Must be at least 8 characters with letters and numbers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                required
                disabled={isPending}
                className="bg-background/50"
              />
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        <p>Access and usage limits are managed from your dashboard billing controls.</p>
      </div>
    </div>
  );
}
