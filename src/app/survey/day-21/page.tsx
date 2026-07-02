import SurveyForm from "@/components/SurveyForm";
import { redirectIfAlreadySubmitted } from "@/lib/survey-page-guard";
import { SURVEYS } from "@/lib/surveys";

export default async function Day21Page({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  await redirectIfAlreadySubmitted("day-21");

  return (
    <SurveyForm
      surveyType="day-21"
      title="Day 21 Personalized Phase Check-In"
      questions={SURVEYS["day-21"]}
      variant={searchParams.variant}
      context={{
        calmScore: searchParams.calmScore,
        interventionCount: searchParams.interventionCount,
        userSegment: searchParams.userSegment
      }}
    />
  );
}
