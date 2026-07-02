export const SURVEY_TYPES = [
  "day-7",
  "day-14",
  "day-21",
  "nightly-recap"
] as const;

export type SurveyType = (typeof SURVEY_TYPES)[number];

/** How the question is answered in the UI. */
export type QuestionType = "single" | "multi" | "slider" | "text";

export type SurveyQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  /** Present for single / multi questions. */
  options?: string[];
  /** For slider questions. Defaults: min=0, max=10. */
  min?: number;
  max?: number;
};

export const SURVEYS: Record<SurveyType, SurveyQuestion[]> = {
  "day-7": [
    {
      id: "q0",
      type: "single",
      label: "Which of the following best describes you today?",
      options: [
        "I am a student whose anxiety is primarily tied to academic life",
        "I am a working professional whose anxiety is primarily tied to career and workplace pressure",
        "I am an adult living with ongoing anxiety that has not been resolved by previous treatments or solutions",
        "Other: ________"
      ]
    },
    {
      id: "q1",
      type: "single",
      label: "How would you rate your experience using the app over the past 7 days?",
      options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    },
    {
      id: "q2",
      type: "single",
      label: "How would you describe your experience with this week's vibration(s)?",
      options: [
        "Very calming",
        "Somewhat calming",
        "Neutral - no real effect",
        "Somewhat distracting",
        "Very distracting"
      ]
    },
    {
      id: "q3",
      type: "single",
      label: "How do you prefer the vibration intensity compared to how it is now?",
      options: [
        "1 - Much weaker",
        "2 - Weaker",
        "3 - Now is just fine",
        "4 - Stronger",
        "5 - Much stronger"
      ]
    },
    {
      id: "q4",
      type: "single",
      label: "How many vibrations a day works the best for you?",
      options: ["1–3", "4–6", "6+, as much as needed"]
    },
    {
      id: "q5",
      type: "single",
      label: "How is the duration of the vibration?",
      options: [
        "1 - Way too short",
        "2 - Shorter than needed",
        "3 - Now is just fine",
        "4 - Longer than needed",
        "5 - Way too long"
      ]
    }
  ],

  "day-14": [
    {
      id: "q1",
      type: "single",
      label: "Overall, how would you rate your CalmingBeats experience over the past 14 days?",
      options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    },
    {
      id: "q2",
      type: "single",
      label: "Over the past 14 days, how has your anxiety changed?",
      options: [
        "Significantly improved",
        "Somewhat improved",
        "About the same",
        "Somewhat worse",
        "Significantly worse"
      ]
    },
    {
      id: "q3",
      type: "single",
      label: "How well does CalmingBeats deliver immediate relief (when needed most)?",
      options: ["Not well at all", "Slightly well", "Moderately well", "Very well", "Extremely well"]
    },
    {
      id: "q4",
      type: "single",
      label: "How well does CalmingBeats work discreetly?",
      options: ["Not well at all", "Slightly well", "Moderately well", "Very well", "Extremely well"]
    },
    {
      id: "q5",
      type: "single",
      label: "How well does CalmingBeats fit into your daily routine?",
      options: ["Not well at all", "Slightly well", "Moderately well", "Very well", "Extremely well"]
    },
    {
      id: "q6",
      type: "single",
      label: "How well does CalmingBeats catch anxiety before it spirals?",
      options: ["Not well at all", "Slightly well", "Moderately well", "Very well", "Extremely well"]
    },
    {
      id: "q7",
      type: "multi",
      label: "What has CalmingBeats done well over these two weeks? (Select all that apply)",
      options: [
        "Learned my patterns/triggers accurately",
        "Vibration timing improved over time",
        "Reduced my overall anxiety",
        "Stayed discreet and easy to use",
        "Became less intrusive as it learned",
        "Other: _________"
      ]
    },
    {
      id: "q8",
      type: "multi",
      label: "What could CalmingBeats improve? (Select all that apply)",
      options: [
        "Learning my patterns more accurately",
        "Better timing of vibration",
        "Greater reduction in anxiety",
        "Feeling less intrusive or distracting",
        "Reducing notification frequency",
        "Nothing - everything has been working well",
        "Other: _______"
      ]
    },
    {
      id: "q9",
      type: "multi",
      label: "While using CalmingBeats, what other anxiety solutions are you using? (Select all that apply)",
      options: [
        "Guided breathing",
        "Mindfulness or meditation",
        "Journaling",
        "Anxiety supplements",
        "Anxiety medication",
        "Chatbot",
        "None",
        "Other: _______"
      ]
    },
    {
      id: "q10",
      type: "single",
      label: "Which new feature would you most like to see in CalmingBeats?",
      options: [
        "Guided breathing",
        "Mindfulness or meditation",
        "Journaling",
        "Chatbot",
        "Insights about my anxiety",
        "Insights about my health in general",
        "Actions I can take for my anxiety",
        "Educational content about how CalmingBeats work"
      ]
    }
  ],

  "day-21": [
    {
      id: "q1",
      type: "slider",
      label: "On a scale of 0–10, how likely are you to recommend CalmingBeats to a friend?",
      min: 0,
      max: 10
    },
    {
      id: "q2",
      type: "single",
      label: "Compared to Day 1, how well does CalmingBeats feel personalized to you now?",
      options: [
        "Much more personalized",
        "Somewhat more personalized",
        "About the same",
        "Somewhat less personalized",
        "Much less personalized"
      ]
    },
    {
      id: "q3",
      type: "single",
      label: "Now that the app is fully adapted, is the current vibration frequency right for you?",
      options: ["Way too few", "Slightly too few", "Just right", "Slightly too many", "Way too many"]
    },
    {
      id: "q4",
      type: "single",
      label: "How likely are you to continue using CalmingBeats going forward?",
      options: [
        "Definitely will continue",
        "Probably will continue",
        "Not sure",
        "Probably will stop",
        "Definitely will stop"
      ]
    },
    {
      id: "q5",
      type: "single",
      label: "We would love to hop on a call to learn about your experience. Can we reach out to you for a 10-minute interview?",
      options: ["Yes", "No"]
    },
    {
      id: "q6",
      type: "text",
      label: "What is the single biggest improvement you'd want to see next?"
    }
  ],

  "nightly-recap": [
    {
      id: "q1",
      type: "single",
      label: "How did CalmingBeats do today?",
      options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    }
  ]
};

export function isSurveyType(value: string): value is SurveyType {
  return SURVEY_TYPES.includes(value as SurveyType);
}
