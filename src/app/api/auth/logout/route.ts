import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use Auth.js signOut() via server action.",
    },
    { status: 410 }
  );
}
