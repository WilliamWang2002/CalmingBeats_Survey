import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SurveyForm from "@/components/SurveyForm";
import type { SurveyQuestion } from "@/lib/surveys";

function mockTrackerInit() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "test-session-id" })
    })
  );
}

describe("SurveyForm", () => {
  beforeEach(() => {
    mockTrackerInit();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("enables submit after a required single-select answer is chosen", async () => {
    const questions: SurveyQuestion[] = [
      {
        id: "q1",
        type: "single",
        label: "How did CalmingBeats do today?",
        options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
      }
    ];

    const user = userEvent.setup();
    render(
      <SurveyForm surveyType="nightly-recap" title="Nightly Recap" questions={questions} />
    );

    const submitButton = screen.getByRole("button", { name: "Submit Survey" });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByText("4 - Good"));

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('requires custom text when "Other" is selected', async () => {
    const questions: SurveyQuestion[] = [
      {
        id: "q1",
        type: "single",
        label: "Which option fits best?",
        options: ["Option A", "Other: ________"]
      }
    ];

    const user = userEvent.setup();
    render(<SurveyForm surveyType="day-7" title="Day 7" questions={questions} />);

    const submitButton = screen.getByRole("button", { name: "Submit Survey" });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByText("Other (please specify)"));

    const otherInput = await screen.findByPlaceholderText("Please specify...");
    expect(otherInput).toBeVisible();
    expect(submitButton).toBeDisabled();

    await user.type(otherInput, "My own answer");

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });
});
