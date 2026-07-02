import mongoose, { Model, Schema } from "mongoose";
import { SURVEY_TYPES, SurveyType } from "@/lib/surveys";

export type QuestionEvent = {
  questionId: string;
  occurredAt: Date;
  isEdit: boolean;
};

export type SurveyTracker = {
  userId: string;
  sessionId: string;
  surveyType: SurveyType;
  surveyOpenTime: Date;
  questionEvents: QuestionEvent[];
  finalSubmitTime: Date | null;
  createdAt: Date;
};

const QuestionEventSchema = new Schema<QuestionEvent>(
  {
    questionId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    isEdit: { type: Boolean, required: true }
  },
  { _id: false }
);

const SurveyTrackerSchema = new Schema<SurveyTracker>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    surveyType: { type: String, required: true, enum: SURVEY_TYPES, index: true },
    surveyOpenTime: { type: Date, required: true, default: () => new Date() },
    questionEvents: { type: [QuestionEventSchema], default: [] },
    finalSubmitTime: { type: Date, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() }
  },
  { versionKey: false, collection: "surveyTrackers" }
);

export const SurveyTrackerModel: Model<SurveyTracker> =
  mongoose.models.SurveyTracker || mongoose.model<SurveyTracker>("SurveyTracker", SurveyTrackerSchema);
