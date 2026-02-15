import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /signup with server actions and Auth.js credentials flow.",
    },
    { status: 410 }
  );
}
