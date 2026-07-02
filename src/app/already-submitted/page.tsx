import Link from "next/link";

type AlreadySubmittedPageProps = {
  searchParams: { surveyType?: string };
};

function prettySurveyType(input?: string): string {
  switch (input) {
    case "day-7":
      return "Day 7";
    case "day-14":
      return "Day 14";
    case "day-21":
      return "Day 21";
    case "nightly-recap":
      return "Nightly Recap";
    case "post-intervention":
      return "Post-Intervention";
    default:
      return "this survey";
  }
}

export default function AlreadySubmittedPage({ searchParams }: AlreadySubmittedPageProps) {
  const surveyLabel = prettySurveyType(searchParams.surveyType);

  return (
    <main>
      <div className="max-w-xl mx-auto pt-16 px-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8 text-center space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Survey already submitted</h1>
          <p className="text-sm text-muted-foreground">
            You have already submitted {surveyLabel}. Thank you for your response.
          </p>
          <div className="pt-2">
            <Link href="/" className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
