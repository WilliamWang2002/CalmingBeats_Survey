import SurveyForm from "@/components/SurveyForm";
import { SURVEYS } from "@/lib/surveys";

export default function PostInterventionPage({
  searchParams
}: {
  searchParams: { calmScore?: string; interventionCount?: string; userSegment?: string; variant?: string };
}) {
  return (
    <SurveyForm
      surveyType="post-intervention"
      title="Post-Intervention Check-In"
      questions={SURVEYS["post-intervention"]}
      variant={searchParams.variant}
      context={{
        calmScore: searchParams.calmScore,
        interventionCount: searchParams.interventionCount,
        userSegment: searchParams.userSegment
      }}
    />
  );
}
