import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, address } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if shop already exists
    const existingShop = await prisma.shop.findUnique({
      where: { email },
    });

    if (existingShop) {
      return NextResponse.json(
        { error: "A shop with this email already exists" },
        { status: 400 }
      );
    }

    // Create shop with subscription
    const passwordHash = await hashPassword(password);
    const shop = await prisma.shop.create({
      data: {
        name,
        email,
        passwordHash,
        phone: phone || null,
        address: address || null,
        subscription: {
          create: {
            plan: "standard",
            monthlyVehicleLimit: 150,
            pricePerMonth: 500,
            overagePrice: 5,
          },
        },
      },
      include: { subscription: true },
    });

    // Create session token
    const token = await createToken({
      shopId: shop.id,
      email: shop.email,
      name: shop.name,
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        subscription: shop.subscription,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register shop" },
      { status: 500 }
    );
  }
}
