import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVehicleAdasSystems } from "@/lib/scrubber";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const adasSystems = await getVehicleAdasSystems(id);
    return NextResponse.json({ adasSystems });
  } catch (error) {
    console.error("Get ADAS systems error:", error);
    return NextResponse.json(
      { error: "Failed to get ADAS systems" },
      { status: 500 }
    );
  }
}
