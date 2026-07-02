import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { SurveyResponseModel } from "@/lib/models/SurveyResponse";
import { SurveyTrackerModel } from "@/lib/models/SurveyTracker";
import { SurveyLaunchCodeModel } from "@/lib/models/SurveyLaunchCode";
import { getSurveySessionFromRequest } from "@/lib/session";
import { SURVEY_TYPES } from "@/lib/surveys";

const payloadSchema = z.object({
  sessionId: z.string().min(1),
  surveyType: z.enum(SURVEY_TYPES),
  variant: z.string().optional(),
  responses: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.unknown()
    })
  ),
  questionEvents: z.array(
    z.object({
      questionId: z.string().min(1),
      occurredAt: z.string().datetime(),
      isEdit: z.boolean()
    })
  ),
  finalSubmitTime: z.string().datetime()
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSurveySessionFromRequest(req);
    const userId = session.userId;
    const body = payloadSchema.parse(await req.json());

    if (session.surveyType && body.surveyType !== session.surveyType) {
      return NextResponse.json({ error: "Survey type mismatch" }, { status: 400 });
    }

    await connectMongo();

    const alreadySubmitted = await SurveyResponseModel.findOne({
      userId,
      surveyType: body.surveyType
    })
      .select({ _id: 1 })
      .lean();

    if (alreadySubmitted?._id) {
      return NextResponse.json({ error: "Survey already submitted" }, { status: 409 });
    }

    await SurveyTrackerModel.findOneAndUpdate(
      { userId, sessionId: body.sessionId },
      {
        $set: {
          questionEvents: body.questionEvents.map((event) => ({
            questionId: event.questionId,
            occurredAt: new Date(event.occurredAt),
            isEdit: event.isEdit
          })),
          finalSubmitTime: new Date(body.finalSubmitTime)
        }
      },
      {
        upsert: false,
        setDefaultsOnInsert: true
      }
    );

    const result = await SurveyResponseModel.create({
      userId,
      sessionId: body.sessionId,
      surveyType: body.surveyType,
      variant: body.variant,
      responses: body.responses,
      submittedAt: new Date(body.finalSubmitTime),
      createdAt: new Date()
    });

    if (session.launchCode) {
      await SurveyLaunchCodeModel.updateOne(
        {
          code: session.launchCode,
          used: false
        },
        {
          $set: {
            used: true,
            usedAt: new Date()
          }
        }
      );
    }

    return NextResponse.json({ ok: true, id: result._id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save survey" },
      { status: 400 }
    );
  }
}
