export const SURVEY_TYPES = [
  "day-7",
  "day-14",
  "day-21",
  "post-intervention",
  "nightly-recap"
] as const;

export type SurveyType = (typeof SURVEY_TYPES)[number];

export type SurveyQuestion = {
  id: string;
  label: string;
  options: string[];
};

export const SURVEYS: Record<SurveyType, SurveyQuestion[]> = {
  "day-7": [
    {
      id: "q1",
      label: "How would you rate your experience using the app over the past 7 days?",
      options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    },
    {
      id: "q2",
      label: "How would you describe your experience with today's intervention(s)?",
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
      label: "Did you receive enough interventions today?",
      options: [
        "Way too few",
        "Slightly too few",
        "Just the right amount",
        "Slightly too many",
        "Way too many"
      ]
    },
    {
      id: "q4",
      label: "Were the interventions helpful today?",
      options: [
        "Very helpful",
        "Somewhat helpful",
        "Neutral",
        "Somewhat unhelpful",
        "Not helpful at all"
      ]
    },
    {
      id: "q5",
      label: "Going forward, would you like more or fewer interventions?",
      options: ["Many more", "Slightly more", "Keep it the same", "Slightly fewer", "Many fewer"]
    }
  ],
  "day-14": [
    {
      id: "q1",
      label: "Overall, how would you rate your CalmingBeats experience over the past 14 days?",
      options: ["1 - Very poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    },
    {
      id: "q2",
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
      label: "Over the past 14 days, has your anxiety changed?",
      options: [
        "Significantly improved",
        "Somewhat improved",
        "About the same",
        "Somewhat worse",
        "Significantly worse"
      ]
    },
    {
      id: "q4",
      label: "Now that the app is fully adapted, is the current intervention frequency right for you?",
      options: ["Way too few", "Slightly too few", "Just right", "Slightly too many", "Way too many"]
    },
    {
      id: "q5",
      label: "How likely are you to continue using CalmingBeats going forward?",
      options: [
        "Definitely will continue",
        "Probably will continue",
        "Not sure",
        "Probably will stop",
        "Definitely will stop"
      ]
    }
  ],
  "day-21": [
    {
      id: "q1",
      label: "How well does CalmingBeats personalize to you now?",
      options: ["Very well", "Well", "Neutral", "Poorly", "Very poorly"]
    },
    {
      id: "q2",
      label: "Would you be open to a short follow-up interview?",
      options: ["Yes", "Maybe", "No"]
    }
  ],
  "post-intervention": [
    {
      id: "q1",
      label: "How useful was this intervention?",
      options: ["1", "2", "3", "4", "5"]
    },
    {
      id: "q2",
      label: "How did you feel before?",
      options: ["1", "2", "3", "4", "5"]
    },
    {
      id: "q3",
      label: "How do you feel after?",
      options: ["1", "2", "3", "4", "5"]
    }
  ],
  "nightly-recap": [
    {
      id: "q1",
      label: "How did CalmingBeats do today?",
      options: ["1", "2", "3", "4", "5"]
    },
    {
      id: "q2",
      label: "Would you like more or fewer interventions?",
      options: ["Many more", "Slightly more", "Keep it the same", "Slightly fewer", "Many fewer"]
    }
  ]
};

export function isSurveyType(value: string): value is SurveyType {
  return SURVEY_TYPES.includes(value as SurveyType);
}
