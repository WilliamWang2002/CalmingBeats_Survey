import { connectMongo } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { SurveyResponseModel } from "@/lib/models/SurveyResponse";
import { SurveyType } from "@/lib/surveys";

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function getUserIdByEmail(rawEmail: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    throw new Error("Email is required");
  }

  await connectMongo();
  const user = await UserModel.findOne({ email }).select({ _id: 1 }).lean();
  if (!user?._id) {
    throw new Error("User not found for email");
  }

  return String(user._id);
}

export async function hasSubmittedSurvey(userId: string, surveyType: SurveyType): Promise<boolean> {
  await connectMongo();
  const existing = await SurveyResponseModel.findOne({ userId, surveyType }).select({ _id: 1 }).lean();
  return Boolean(existing?._id);
}
