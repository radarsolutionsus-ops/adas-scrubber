"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { createStripeCustomer, isStripeConfigured } from "@/lib/billing/stripe";

export interface RegisterState {
  error?: string;
  success?: boolean;
}

export async function register(
  _prevState: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  try {
    const shopName = formData.get("shopName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validation
    if (!shopName || !email || !password) {
      return { error: "All fields are required" };
    }

    if (shopName.length < 2) {
      return { error: "Shop name must be at least 2 characters" };
    }

    if (!email.includes("@")) {
      return { error: "Please enter a valid email address" };
    }

    if (password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return { error: "Password must include at least one letter and one number" };
    }

    if (password !== confirmPassword) {
      return { error: "Passwords do not match" };
    }

    // Check if email already exists
    const existingShop = await prisma.shop.findUnique({
      where: { email },
    });

    if (existingShop) {
      return { error: "An account with this email already exists" };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create account first; Stripe customer is attached after we have shop id metadata.
    const createdShop = await prisma.shop.create({
      data: {
        name: shopName,
        email,
        passwordHash,
        role: "SHOP_OWNER",
        subscription: {
          create: {
            plan: "standard",
            status: "active",
            monthlyVehicleLimit: 150,
            pricePerMonth: 500,
            overagePrice: 5,
          },
        },
      },
    });

    if (isStripeConfigured()) {
      try {
        const stripeCustomerId = await createStripeCustomer({
          shopId: createdShop.id,
          email,
          name: shopName,
        });
        await prisma.shop.update({
          where: { id: createdShop.id },
          data: { stripeCustomerId },
        });
      } catch (stripeError) {
        console.error("Stripe customer creation failed:", stripeError);
      }
    }

    // Sign in the new user
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Failed to sign in after registration" };
    }

    // If it's a redirect error from signIn, let it propagate
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Registration error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
