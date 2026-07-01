import mongoose, { Model, Schema } from "mongoose";

export type SurveyLaunchCode = {
  code: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  usedAt: Date | null;
  createdAt: Date;
};

const SurveyLaunchCodeSchema = new Schema<SurveyLaunchCode>(
  {
    code: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
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
