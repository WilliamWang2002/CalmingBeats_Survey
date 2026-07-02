"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SurveyQuestion, SurveyType } from "@/lib/surveys";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Returns true if the option is the "Other (please specify)" option. */
function isOtherOption(option: string) {
  return option.startsWith("Other");
}

/** Clean display label — strips trailing ": ____" patterns from "Other: _____". */
function displayLabel(option: string) {
  if (isOtherOption(option)) return "Other (please specify)";
  return option;
}

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

/** Per-question free text when the user picks "Other". */
type OtherTexts = Record<string, string>;

function isOtherSelected(q: SurveyQuestion, answers: Answers): boolean {
  if (q.type === "single") {
    return typeof answers[q.id] === "string" && isOtherOption(answers[q.id] as string);
  }
  if (q.type === "multi") {
    return Array.isArray(answers[q.id]) &&
      (answers[q.id] as string[]).some(isOtherOption);
  }
  return false;
}

function isAnswered(q: SurveyQuestion, answers: Answers, otherTexts: OtherTexts): boolean {
  const v = answers[q.id];
  if (q.type === "multi") {
    if (!Array.isArray(v) || v.length === 0) return false;
    if ((v as string[]).some(isOtherOption) && !otherTexts[q.id]?.trim()) return false;
    return true;
  }
  if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
  if (q.type === "single") {
    if (typeof v !== "string" || v.length === 0) return false;
    if (isOtherOption(v) && !otherTexts[q.id]?.trim()) return false;
    return true;
  }
  return typeof v === "string" && v.length > 0;
}

function serializeAnswer(
  q: SurveyQuestion,
  answers: Answers,
  otherTexts: OtherTexts
): string {
  const v = answers[q.id];
  if (q.type === "multi" && Array.isArray(v)) {
    return (v as string[])
      .map((item) => (isOtherOption(item) ? `Other: ${otherTexts[q.id] ?? ""}` : item))
      .join(", ");
  }
  if (typeof v === "string" && isOtherOption(v)) {
    return `Other: ${otherTexts[q.id] ?? ""}`;
  }
  if (Array.isArray(v)) return v.join(", ");
  return v ?? "";
}

export default function SurveyForm({ surveyType, title, questions, variant, context }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [otherTexts, setOtherTexts] = useState<OtherTexts>({});
  const [events, setEvents] = useState<QuestionEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [initError, setInitError] = useState<string>("");
  const trackerInitPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (!trackerInitPromiseRef.current) {
      trackerInitPromiseRef.current = fetch("/api/tracker", { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to initialize tracker session");
        }
        const data = (await res.json()) as { sessionId: string };
        return data.sessionId;
      });
    }

    let isActive = true;
    trackerInitPromiseRef.current
      .then((id) => {
        if (isActive) setSessionId(id);
      })
      .catch((err: unknown) => {
        if (isActive) {
          setInitError(err instanceof Error ? err.message : "Failed to initialize");
        }
        trackerInitPromiseRef.current = null;
      });

    return () => {
      isActive = false;
    };
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q, answers, otherTexts)).length,
    [answers, otherTexts, questions]
  );
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const canSubmit =
    Boolean(sessionId) &&
    questions.every((q) => isAnswered(q, answers, otherTexts)) &&
    !isSubmitting &&
    submitStatus !== "done";

  function recordEvent(questionId: string, wasAnswered: boolean) {
    setEvents((prev) => [
      ...prev,
      { questionId, occurredAt: new Date().toISOString(), isEdit: wasAnswered }
    ]);
  }

  function setSingleAnswer(questionId: string, value: string) {
    const was = isAnswered(questions.find((q) => q.id === questionId)!, answers, otherTexts);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear saved "other" text when user switches away from Other
    if (!isOtherOption(value)) {
      setOtherTexts((prev) => { const n = { ...prev }; delete n[questionId]; return n; });
    }
    recordEvent(questionId, was);
  }

  function toggleMultiAnswer(questionId: string, option: string, checked: boolean) {
    const was = isAnswered(questions.find((q) => q.id === questionId)!, answers, otherTexts);
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, [questionId]: next };
    });
    // Clear "other" text when unchecking Other
    if (!checked && isOtherOption(option)) {
      setOtherTexts((prev) => { const n = { ...prev }; delete n[questionId]; return n; });
    }
    recordEvent(questionId, was);
  }

  function setOtherText(questionId: string, text: string) {
    setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
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
          answer: serializeAnswer(q, answers, otherTexts)
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
        <Card className="shadow-sm border-0 overflow-hidden">
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#9AD4BD]/35 flex items-center justify-center text-2xl text-[#183229] font-bold">&#10003;</div>
            <h2 className="text-xl font-semibold text-[#183229]">Thank you!</h2>
            <p className="text-[#183229]/70 text-sm">Your response has been recorded.</p>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main>
      {/* Header card */}
      <Card className="mb-5 shadow-sm">
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-2xl font-semibold text-foreground leading-snug">{title}</h1>
          {(context?.userSegment || context?.calmScore || context?.interventionCount) && (
            <p className="text-xs text-muted-foreground mt-1">
              {[
                context.userSegment && `Segment: ${context.userSegment}`,
                context.interventionCount && `Interventions: ${context.interventionCount}`,
                context.calmScore && `Calm score: ${context.calmScore}`
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <CardContent className="pt-0 pb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span className="font-medium">
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
            <p className="text-sm font-medium text-foreground mb-3 leading-snug flex gap-2 items-start">
              <span className="inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] rounded-full bg-primary/20 text-primary text-[0.7rem] font-bold flex-shrink-0 mt-px">
                {idx + 1}
              </span>
              {q.label}
            </p>

            {/* Single-select */}
            {q.type === "single" && q.options && (
              <RadioGroup
                value={(answers[q.id] as string) ?? ""}
                onValueChange={(v) => setSingleAnswer(q.id, v)}
                className="flex flex-col gap-2"
              >
                {q.options.map((option, optionIndex) => (
                  <div key={option} className="flex flex-col gap-1.5">
                    <div
                      data-testid={`${q.id}-option-${optionIndex}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-150",
                        answers[q.id] === option
                          ? "border-primary border-l-[3px] bg-primary/10 pl-[10px]"
                          : "border-border hover:border-primary/40 hover:bg-primary/5"
                      )}
                      onClick={() => setSingleAnswer(q.id, option)}
                    >
                      <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                      <Label
                        htmlFor={`${q.id}-${option}`}
                        className="cursor-pointer text-sm font-normal leading-tight"
                      >
                        {displayLabel(option)}
                      </Label>
                    </div>
                    {isOtherOption(option) && answers[q.id] === option && (
                      <OtherInput
                        id={`${q.id}-other-text`}
                        value={otherTexts[q.id] ?? ""}
                        onChange={(v) => setOtherText(q.id, v)}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Multi-select */}
            {q.type === "multi" && q.options && (
              <div className="flex flex-col gap-2">
                {q.options.map((option, optionIndex) => {
                  const checked =
                    Array.isArray(answers[q.id]) &&
                    (answers[q.id] as string[]).includes(option);
                  return (
                    <div key={option} className="flex flex-col gap-1.5">
                      <div
                        data-testid={`${q.id}-option-${optionIndex}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-150",
                          checked
                            ? "border-primary border-l-[3px] bg-primary/10 pl-[10px]"
                            : "border-border hover:border-primary/40 hover:bg-primary/5"
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
                          className="cursor-pointer text-sm font-normal leading-tight"
                        >
                          {displayLabel(option)}
                        </Label>
                      </div>
                      {isOtherOption(option) && checked && (
                        <OtherInput
                          id={`${q.id}-other-text`}
                          value={otherTexts[q.id] ?? ""}
                          onChange={(v) => setOtherText(q.id, v)}
                        />
                      )}
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
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{answeredCount === questions.length ? "All questions answered" : `${questions.length - answeredCount} remaining`}</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        {errorMsg && (
          <p className="text-destructive text-sm mb-3">{errorMsg}</p>
        )}
        <Button
          data-testid="submit-survey"
          className="w-full font-semibold bg-accent text-accent-foreground hover:bg-accent/85 h-11 text-base rounded-xl"
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

// ─── Other Input ─────────────────────────────────────────────────────────────

function OtherInput({
  id,
  value,
  onChange
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      placeholder="Please specify..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        "animate-in fade-in slide-in-from-top-1 duration-150"
      )}
    />
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

  function npsColor(n: number, selected: boolean) {
    if (selected) {
      if (n <= 4) return "bg-destructive text-white border-destructive";
      if (n <= 6) return "bg-muted-foreground text-white border-muted-foreground";
      return "bg-primary text-primary-foreground border-primary";
    }
    if (n <= 4) return "border-destructive/30 text-destructive/70 hover:bg-destructive/10";
    if (n <= 6) return "border-border text-muted-foreground hover:bg-muted/60";
    return "border-primary/30 text-primary/80 hover:bg-primary/10";
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-11 gap-1">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "rounded-md py-2 text-sm font-semibold border transition-all duration-150",
              npsColor(n, value === n)
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
