type AlreadySubmittedPageProps = {
  searchParams: { surveyType?: string };
};

export default function AlreadySubmittedPage({ searchParams }: AlreadySubmittedPageProps) {
  void searchParams;

  return (
    <main>
      <div className="max-w-xl mx-auto pt-16 px-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#9AD4BD]/35 flex items-center justify-center text-2xl text-[#183229] font-bold">&#10003;</div>
          <h1 className="text-2xl font-semibold text-foreground">Survey already submitted</h1>
          <p className="text-sm text-muted-foreground">Thank you for your response.</p>
        </div>
      </div>
    </main>
  );
}
