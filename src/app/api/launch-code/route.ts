import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { SurveyLaunchCodeModel } from "@/lib/models/SurveyLaunchCode";
import { getUserIdByEmail, hasSubmittedSurvey, normalizeEmail } from "@/lib/auth";
import { SURVEY_TYPES } from "@/lib/surveys";

const payloadSchema = z.object({
  email: z.string().email(),
  surveyType: z.enum(SURVEY_TYPES)
});

export async function POST(req: NextRequest) {
  try {
    const body = payloadSchema.parse(await req.json());
    const email = normalizeEmail(body.email);
    const userId = await getUserIdByEmail(email);
    const alreadySubmitted = await hasSubmittedSurvey(userId, body.surveyType);
    if (alreadySubmitted) {
      return NextResponse.json({ error: "Survey already submitted" }, { status: 409 });
    }

    await connectMongo();

    const code = randomBytes(18).toString("hex");
    const expiresAt = new Date(Date.now() + 600 * 1000);
    await SurveyLaunchCodeModel.create({
      code,
      email,
      surveyType: body.surveyType,
      expiresAt,
      used: false,
      usedAt: null,
      createdAt: new Date()
    });

    return NextResponse.json({
      code,
      email,
      surveyType: body.surveyType,
      expiresInSec: 600
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create launch code" },
      { status: 400 }
    );
  }
}
