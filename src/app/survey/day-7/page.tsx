import SurveyForm from "@/components/SurveyForm";
import { SURVEYS } from "@/lib/surveys";

export default function Day7Page({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  return (
    <SurveyForm
      surveyType="day-7"
      title="Day 7 Training Check-In"
      questions={SURVEYS["day-7"]}
      variant={searchParams.variant}
      context={{
        calmScore: searchParams.calmScore,
        interventionCount: searchParams.interventionCount,
        userSegment: searchParams.userSegment
      }}
    />
  );
}
