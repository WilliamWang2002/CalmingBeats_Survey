import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { SurveyResponseModel } from "@/lib/models/SurveyResponse";
import { SurveyTrackerModel } from "@/lib/models/SurveyTracker";
import { getSessionUserIdFromRequest } from "@/lib/session";
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
    const userId = await getSessionUserIdFromRequest(req);
    const body = payloadSchema.parse(await req.json());

    await connectMongo();

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
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    const result = await SurveyResponseModel.findOneAndUpdate(
      {
        sessionId: body.sessionId,
        surveyType: body.surveyType
      },
      {
        $set: {
          userId,
          sessionId: body.sessionId,
          surveyType: body.surveyType,
          variant: body.variant,
          responses: body.responses,
          submittedAt: new Date(body.finalSubmitTime)
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return NextResponse.json({ ok: true, id: result?._id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save survey" },
      { status: 400 }
    );
  }
}
