import { NextRequest, NextResponse } from "next/server";
import { fetchAnnouncements, fetchShuttleService } from "@/lib/nextbus";
import { extractFirstLesson, fetchModuleData } from "@/lib/nusmods";
import { TransitApiResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stop = searchParams.get("stop")?.trim().toUpperCase() || "UTOWN";
    const moduleCode = searchParams.get("module")?.trim().toUpperCase();

    // Fetch shuttle timings and campus announcements concurrently
    const [shuttleData, announcements] = await Promise.all([
      fetchShuttleService(stop),
      fetchAnnouncements(),
    ]);

    let classInfo = null;
    if (moduleCode) {
      const moduleData = await fetchModuleData(moduleCode);
      if (moduleData) {
        classInfo = extractFirstLesson(moduleData);
      }
    }

    const responseData: TransitApiResponse = {
      stopCode: stop,
      stopName: shuttleData.caption || stop,
      isScheduled: shuttleData.isScheduled,
      shuttles: shuttleData.shuttles,
      announcements,
      classInfo,
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw error;
    }

    console.error("API /api/transit error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transit data" },
      { status: 500 }
    );
  }
}
