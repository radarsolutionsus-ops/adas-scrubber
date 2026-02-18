import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVehicles } from "@/lib/scrubber";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
