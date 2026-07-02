import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyTrackerModel } from "@/lib/models/SurveyTracker";
import { getSurveySessionFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSurveySessionFromRequest(req);
    if (!session.surveyType) {
      return NextResponse.json({ error: "Missing survey type in session" }, { status: 400 });
    }

    const userId = session.userId;
    await connectMongo();

    const sessionId = randomUUID();
    await SurveyTrackerModel.create({
      userId,
      sessionId,
      surveyType: session.surveyType,
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
