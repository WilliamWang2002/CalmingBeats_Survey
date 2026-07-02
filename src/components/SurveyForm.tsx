"use client";

import { useEffect, useMemo, useState } from "react";
import { SurveyQuestion, SurveyType } from "@/lib/surveys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  surveyType: SurveyType;
  title: string;
  questions: SurveyQuestion[];
  variant?: string;
  context?: {
    calmScore?: string;
    interventionCount?: string;
    userSegment?: string;
  };
};

type QuestionEvent = {
  questionId: string;
  occurredAt: string;
  isEdit: boolean;
};

/** Each answer is a string (single/slider) or string[] (multi). */
type Answers = Record<string, string | string[]>;

function isAnswered(q: SurveyQuestion, answers: Answers): boolean {
  const v = answers[q.id];
  if (q.type === "multi") return Array.isArray(v) && v.length > 0;
  if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
  return typeof v === "string" && v.length > 0;
}

function serializeAnswer(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  return v ?? "";
}

export default function SurveyForm({ surveyType, title, questions, variant, context }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [events, setEvents] = useState<QuestionEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [initError, setInitError] = useState<string>("");

  useEffect(() => {
    fetch("/api/tracker", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to initialize tracker session");
        const data = (await res.json()) as { sessionId: string };
        setSessionId(data.sessionId);
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : "Failed to initialize");
      });
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q, answers)).length,
    [answers, questions]
  );
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const canSubmit =
    Boolean(sessionId) &&
    questions.every((q) => isAnswered(q, answers)) &&
    !isSubmitting &&
    submitStatus !== "done";

  function recordEvent(questionId: string, wasAnswered: boolean) {
    setEvents((prev) => [
      ...prev,
      { questionId, occurredAt: new Date().toISOString(), isEdit: wasAnswered }
    ]);
  }

  function setSingleAnswer(questionId: string, value: string) {
    const was = isAnswered(questions.find((q) => q.id === questionId)!, answers);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    recordEvent(questionId, was);
  }

  function toggleMultiAnswer(questionId: string, option: string, checked: boolean) {
    const was = isAnswered(questions.find((q) => q.id === questionId)!, answers);
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, [questionId]: next };
    });
    recordEvent(questionId, was);
  }

  async function onSubmit() {
    if (!sessionId) return;
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        sessionId,
        surveyType,
        variant,
        responses: questions.map((q) => ({
          questionId: q.id,
          answer: serializeAnswer(answers[q.id])
        })),
        questionEvents: events,
        finalSubmitTime: new Date().toISOString()
      };

      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to submit survey");
      }

      setSubmitStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitStatus === "done") {
    return (
      <main>
        <Card className="shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl text-primary">&#10003;</div>
            <h2 className="text-xl font-semibold text-foreground">Thank you!</h2>
            <p className="text-muted-foreground text-sm">Your response has been recorded.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main>
      {/* Header card */}
      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {(context?.userSegment || context?.calmScore || context?.interventionCount) && (
            <p className="text-xs text-muted-foreground mt-1">
              {[
                context.userSegment && `Segment: ${context.userSegment}`,
                context.interventionCount && `Interventions today: ${context.interventionCount}`,
                context.calmScore && `Calm score: ${context.calmScore}`
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span>
              {answeredCount} / {questions.length}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {initError && (
        <p className="text-destructive text-sm mb-4 px-1">{initError}</p>
      )}

      {/* Question cards */}
      {questions.map((q, idx) => (
        <Card key={q.id} className="mb-3 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold text-foreground mb-3 leading-snug">
              <span className="text-primary mr-1.5">Q{idx + 1}.</span>
              {q.label}
            </p>

            {/* Single-select */}
            {q.type === "single" && q.options && (
              <RadioGroup
                value={(answers[q.id] as string) ?? ""}
                onValueChange={(v) => setSingleAnswer(q.id, v)}
                className="flex flex-col gap-2"
              >
                {q.options.map((option) => (
                  <div
                    key={option}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                      answers[q.id] === option
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/60"
                    )}
                    onClick={() => setSingleAnswer(q.id, option)}
                  >
                    <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                    <Label
                      htmlFor={`${q.id}-${option}`}
                      className="cursor-pointer text-sm leading-tight"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Multi-select */}
            {q.type === "multi" && q.options && (
              <div className="flex flex-col gap-2">
                {q.options.map((option) => {
                  const checked =
                    Array.isArray(answers[q.id]) &&
                    (answers[q.id] as string[]).includes(option);
                  return (
                    <div
                      key={option}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/60"
                      )}
                      onClick={() => toggleMultiAnswer(q.id, option, !checked)}
                    >
                      <Checkbox
                        id={`${q.id}-${option}`}
                        checked={checked}
                        onCheckedChange={(c) => toggleMultiAnswer(q.id, option, Boolean(c))}
                      />
                      <Label
                        htmlFor={`${q.id}-${option}`}
                        className="cursor-pointer text-sm leading-tight"
                      >
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}

            {/* NPS / Slider */}
            {q.type === "slider" && (
              <NpsSelector
                min={q.min ?? 0}
                max={q.max ?? 10}
                value={answers[q.id] != null ? Number(answers[q.id]) : null}
                onChange={(v) => setSingleAnswer(q.id, String(v))}
              />
            )}

            {/* Open text */}
            {q.type === "text" && (
              <Textarea
                placeholder="Type your answer here..."
                className="resize-none min-h-[96px] text-sm"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setSingleAnswer(q.id, e.target.value)}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {/* Submit */}
      <div className="mt-2 mb-8">
        {errorMsg && (
          <p className="text-destructive text-sm mb-3">{errorMsg}</p>
        )}
        <Button
          className="w-full font-semibold"
          disabled={!canSubmit}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? "Submitting..." : "Submit Survey"}
        </Button>
        {!sessionId && !initError && (
          <p className="text-xs text-muted-foreground text-center mt-2">Initializing...</p>
        )}
      </div>
    </main>
  );
}

// ─── NPS Selector ────────────────────────────────────────────────────────────

function NpsSelector({
  min,
  max,
  value,
  onChange
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-11 gap-1">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "rounded-md py-2 text-sm font-semibold border transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background hover:bg-muted/60 text-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-0.5">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}
