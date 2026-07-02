import SurveyForm from "@/components/SurveyForm";
import { redirectIfAlreadySubmitted } from "@/lib/survey-page-guard";
import { SURVEYS } from "@/lib/surveys";

export default async function Day14Page({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  await redirectIfAlreadySubmitted("day-14");

  return (
    <SurveyForm
      surveyType="day-14"
      title="Day 14 Adaptation Check-In"
      questions={SURVEYS["day-14"]}
      variant={searchParams.variant}
      context={{
        calmScore: searchParams.calmScore,
        interventionCount: searchParams.interventionCount,
        userSegment: searchParams.userSegment
      }}
    />
  );
}
