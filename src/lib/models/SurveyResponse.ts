import mongoose, { Model, Schema } from "mongoose";
import { SURVEY_TYPES, SurveyType } from "@/lib/surveys";

export type SurveyAnswer = {
  questionId: string;
  answer: unknown;
};

export type SurveyResponse = {
  userId: string;
  sessionId: string;
  surveyType: SurveyType;
  variant?: string;
  responses: SurveyAnswer[];
  submittedAt: Date;
  createdAt: Date;
};

const SurveyAnswerSchema = new Schema<SurveyAnswer>(
  {
    questionId: { type: String, required: true },
    answer: { type: Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const SurveyResponseSchema = new Schema<SurveyResponse>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    surveyType: { type: String, required: true, enum: SURVEY_TYPES, index: true },
    variant: { type: String, required: false },
    responses: { type: [SurveyAnswerSchema], default: [] },
    submittedAt: { type: Date, required: true, default: () => new Date() },
    createdAt: { type: Date, required: true, default: () => new Date() }
  },
  { versionKey: false, collection: "surveyResponses" }
);

SurveyResponseSchema.index({ userId: 1, surveyType: 1 }, { unique: true });

export const SurveyResponseModel: Model<SurveyResponse> =
  mongoose.models.SurveyResponse || mongoose.model<SurveyResponse>("SurveyResponse", SurveyResponseSchema);
