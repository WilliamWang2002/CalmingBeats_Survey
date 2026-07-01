import SurveyForm from "@/components/SurveyForm";
import { SURVEYS } from "@/lib/surveys";

export default function NightlyRecapPage({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  return (
    <SurveyForm
      surveyType="nightly-recap"
      title="Nightly Recap"
      questions={SURVEYS["nightly-recap"]}
      variant={searchParams.variant}
      context={{
        calmScore: searchParams.calmScore,
        interventionCount: searchParams.interventionCount,
        userSegment: searchParams.userSegment
      }}
    />
  );
}
