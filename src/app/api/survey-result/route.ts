import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyResponseModel } from "@/lib/models/SurveyResponse";
import { SurveyTrackerModel } from "@/lib/models/SurveyTracker";
import { getSessionUserIdFromRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserIdFromRequest(req);
    await connectMongo();

    const responses = await SurveyResponseModel.find({ userId }).sort({ submittedAt: -1 }).limit(20).lean();
    const sessionIds = responses.map((r) => r.sessionId);
    const trackers = await SurveyTrackerModel.find({ userId, sessionId: { $in: sessionIds } }).lean();

    return NextResponse.json({ responses, trackers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}
