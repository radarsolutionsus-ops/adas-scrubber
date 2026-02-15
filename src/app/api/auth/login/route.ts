import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /login with Auth.js credentials flow.",
    },
    { status: 410 }
  );
}
