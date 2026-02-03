import { NextRequest, NextResponse } from "next/server";
import { getVehicleAdasSystems } from "@/lib/scrubber";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
