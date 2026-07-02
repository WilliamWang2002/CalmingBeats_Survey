import SurveyForm from "@/components/SurveyForm";
import { redirectIfAlreadySubmitted } from "@/lib/survey-page-guard";
import { SURVEYS } from "@/lib/surveys";

export default async function NightlyRecapPage({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  await redirectIfAlreadySubmitted("nightly-recap");

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
