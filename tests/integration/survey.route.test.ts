// @vitest-environment node

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/survey/route";
import { createSurveySessionToken } from "@/lib/session";
import { connectTestMongo, disconnectTestMongo, getDb, resetTestData, seedUser } from "./helpers/mongo";

const TEST_EMAIL = "integration-submit@example.com";

function cookieHeader(token: string) {
  return `survey_session=${token}`;
}

async function seedTracker(userId: string, sessionId: string) {
  await getDb().collection("surveyTrackers").insertOne({
    userId,
    sessionId,
    surveyType: "nightly-recap",
    surveyOpenTime: new Date(),
    questionEvents: [],
    finalSubmitTime: null,
    createdAt: new Date()
  });
}

describe("POST /api/survey", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "integration-test-secret";
    await connectTestMongo();
  });

  beforeEach(async () => {
    await resetTestData([TEST_EMAIL]);
    await seedUser(TEST_EMAIL);
  });

  afterAll(async () => {
    await disconnectTestMongo();
  });

  it("writes a survey response and updates its tracker", async () => {
    const user = await getDb().collection("users").findOne({ email: TEST_EMAIL });
    const userId = String(user?._id);
    const sessionId = "session-1";
    await seedTracker(userId, sessionId);

    const token = await createSurveySessionToken({
      userId,
      surveyType: "nightly-recap"
    });

    const req = new NextRequest("http://localhost/api/survey", {
      method: "POST",
      headers: {
        cookie: cookieHeader(token),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        surveyType: "nightly-recap",
        responses: [{ questionId: "q1", answer: "4 - Good" }],
        questionEvents: [
          {
            questionId: "q1",
            occurredAt: new Date().toISOString(),
            isEdit: false
          }
        ],
        finalSubmitTime: new Date().toISOString()
      })
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const response = await getDb().collection("surveyResponses").findOne({
      userId,
      sessionId,
      surveyType: "nightly-recap"
    });
    const tracker = await getDb().collection("surveyTrackers").findOne({
      userId,
      sessionId
    });

    expect(response).toBeTruthy();
    expect(tracker?.finalSubmitTime).toBeTruthy();
    expect(tracker?.questionEvents).toHaveLength(1);
  });

  it("returns 400 when the session surveyType mismatches the payload", async () => {
    const user = await getDb().collection("users").findOne({ email: TEST_EMAIL });
    const userId = String(user?._id);
    const sessionId = "session-2";
    await seedTracker(userId, sessionId);

    const token = await createSurveySessionToken({
      userId,
      surveyType: "day-7"
    });

    const req = new NextRequest("http://localhost/api/survey", {
      method: "POST",
      headers: {
        cookie: cookieHeader(token),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        surveyType: "nightly-recap",
        responses: [{ questionId: "q1", answer: "4 - Good" }],
        questionEvents: [],
        finalSubmitTime: new Date().toISOString()
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Survey type mismatch" });
  });

  it("marks the launch code used after a successful code-backed submission", async () => {
    const user = await getDb().collection("users").findOne({ email: TEST_EMAIL });
    const userId = String(user?._id);
    const sessionId = "session-3";
    await seedTracker(userId, sessionId);
    await getDb().collection("surveyLaunchCodes").insertOne({
      code: "launch-code-xyz",
      email: TEST_EMAIL,
      surveyType: "nightly-recap",
      expiresAt: new Date(Date.now() + 60_000),
      used: false,
      usedAt: null,
      createdAt: new Date()
    });

    const token = await createSurveySessionToken({
      userId,
      surveyType: "nightly-recap",
      launchCode: "launch-code-xyz"
    });

    const req = new NextRequest("http://localhost/api/survey", {
      method: "POST",
      headers: {
        cookie: cookieHeader(token),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        surveyType: "nightly-recap",
        responses: [{ questionId: "q1", answer: "5 - Excellent" }],
        questionEvents: [],
        finalSubmitTime: new Date().toISOString()
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const launchCode = await getDb().collection("surveyLaunchCodes").findOne({
      code: "launch-code-xyz"
    });

    expect(launchCode?.used).toBe(true);
    expect(launchCode?.usedAt).toBeTruthy();
  });
});
