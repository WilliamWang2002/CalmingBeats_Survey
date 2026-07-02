import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSubmittedSurvey } from "@/lib/auth";
import { getSurveySessionFromCookieHeader } from "@/lib/session";
import { SurveyType } from "@/lib/surveys";

export async function redirectIfAlreadySubmitted(surveyType: SurveyType): Promise<void> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) {
    return;
  }

  let alreadySubmitted = false;
  try {
    const session = await getSurveySessionFromCookieHeader(cookieHeader);
    alreadySubmitted = await hasSubmittedSurvey(session.userId, surveyType);
  } catch {
    // Ignore invalid/missing cookie and allow normal survey rendering.
    return;
  }

  if (alreadySubmitted) {
    redirect("/already-submitted");
  }
}
