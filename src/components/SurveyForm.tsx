"use client";

import { SurveyQuestion, SurveyType } from "@/lib/surveys";
import { useEffect, useMemo, useState } from "react";

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

export default function SurveyForm({ surveyType, title, questions, variant, context }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<QuestionEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("Preparing survey...");

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/tracker", { method: "POST" });
        if (!res.ok) {
          throw new Error("Failed to initialize tracker session");
        }
        const data = (await res.json()) as { sessionId: string };
        setSessionId(data.sessionId);
        setStatus("Ready");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to initialize");
      }
    };

    init().catch(() => {
      setStatus("Failed to initialize");
    });
  }, []);

  const canSubmit = useMemo(
    () => Boolean(sessionId) && questions.every((q) => Boolean(answers[q.id])) && !isSubmitting,
    [answers, isSubmitting, questions, sessionId]
  );

  function onAnswer(questionId: string, value: string) {
    const isEdit = Boolean(answers[questionId]);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setEvents((prev) => [
      ...prev,
      {
        questionId,
        occurredAt: new Date().toISOString(),
        isEdit
      }
    ]);
  }

  async function onSubmit() {
    if (!sessionId) {
      return;
    }

    setIsSubmitting(true);
    setStatus("Submitting...");

    try {
      const payload = {
        sessionId,
        surveyType,
        variant,
        responses: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] })),
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

      setStatus("Thanks! Your response was submitted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Submission failed");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  return (
    <main>
      <div className="card">
        <h1>{title}</h1>
        <p className="muted">Survey type: {surveyType}</p>
        {variant ? <p className="muted">Variant: {variant}</p> : null}
        {context?.userSegment ? <p className="muted">Segment: {context.userSegment}</p> : null}
        {(context?.calmScore || context?.interventionCount) && (
          <p className="muted">
            {context.interventionCount ? `Interventions today: ${context.interventionCount}. ` : ""}
            {context.calmScore ? `Calm score: ${context.calmScore}.` : ""}
          </p>
        )}
      </div>

      <div className="card">
        {questions.map((q) => (
          <div key={q.id} className="question">
            <label>{q.label}</label>
            <div className="options">
              {q.options.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name={q.id}
                    value={option}
                    checked={answers[q.id] === option}
                    onChange={(e) => onAnswer(q.id, e.target.value)}
                  />{" "}
                  {option}
                </label>
              ))}
            </div>
          </div>
        ))}

        <button className="button" disabled={!canSubmit} onClick={onSubmit} type="button">
          Submit
        </button>
        <p className="muted" style={{ marginTop: 10 }}>
          {status}
        </p>
      </div>
    </main>
  );
}
