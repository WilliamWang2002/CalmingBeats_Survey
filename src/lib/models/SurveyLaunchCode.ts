import mongoose, { Model, Schema } from "mongoose";
import { SURVEY_TYPES, SurveyType } from "@/lib/surveys";

export type SurveyLaunchCode = {
  code: string;
  email: string;
  surveyType: SurveyType;
  expiresAt: Date;
  used: boolean;
  usedAt: Date | null;
  createdAt: Date;
};

const SurveyLaunchCodeSchema = new Schema<SurveyLaunchCode>(
  {
    code: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    surveyType: { type: String, required: true, enum: SURVEY_TYPES, index: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, required: true, default: false, index: true },
    usedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() }
  },
  { versionKey: false, collection: "surveyLaunchCodes" }
);

export const SurveyLaunchCodeModel: Model<SurveyLaunchCode> =
  mongoose.models.SurveyLaunchCode ||
  mongoose.model<SurveyLaunchCode>("SurveyLaunchCode", SurveyLaunchCodeSchema);
