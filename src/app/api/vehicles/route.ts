import { NextResponse } from "next/server";
import { getVehicles } from "@/lib/scrubber";

export async function GET() {
  try {
    const vehicles = await getVehicles();
    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Get vehicles error:", error);
    return NextResponse.json(
      { error: "Failed to get vehicles" },
      { status: 500 }
    );
  }
}
