import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyTrackerModel } from "@/lib/models/SurveyTracker";
import { getSessionUserIdFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserIdFromRequest(req);
    await connectMongo();

    const sessionId = randomUUID();
    await SurveyTrackerModel.create({
      userId,
      sessionId,
      surveyOpenTime: new Date(),
      questionEvents: [],
      finalSubmitTime: null,
      createdAt: new Date()
    });

    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize tracker" },
      { status: 401 }
    );
  }
}
