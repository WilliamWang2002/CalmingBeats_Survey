import SurveyForm from "@/components/SurveyForm";
import { SURVEYS } from "@/lib/surveys";

export default function Day21Page({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
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
