// @vitest-environment node

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as startGet } from "@/app/start/route";
import { POST as trackerPost } from "@/app/api/tracker/route";
import { createSurveySessionToken } from "@/lib/session";
import { connectTestMongo, disconnectTestMongo, getDb, resetTestData, seedUser } from "./helpers/mongo";

const TEST_EMAIL = "integration-start@example.com";
const CODE_EMAIL = "integration-code@example.com";

function cookieHeader(token: string) {
  return `survey_session=${token}`;
}

describe("/start and /api/tracker integration", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "integration-test-secret";
    await connectTestMongo();
  });

  beforeEach(async () => {
    await resetTestData([TEST_EMAIL, CODE_EMAIL]);
    await seedUser(TEST_EMAIL);
    await seedUser(CODE_EMAIL);
  });

  afterAll(async () => {
    await disconnectTestMongo();
  });

  it("redirects email+surveyType requests and sets a session cookie", async () => {
    const req = new NextRequest(`http://localhost/start?email=${TEST_EMAIL}&surveyType=nightly-recap`);
    const res = await startGet(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/survey/nightly-recap");
    expect(res.headers.get("set-cookie")).toContain("survey_session=");
  });

  it("redeems a launch code and redirects using the stored survey type", async () => {
    await getDb().collection("surveyLaunchCodes").insertOne({
      code: "launch-code-123",
      email: CODE_EMAIL,
      surveyType: "day-21",
      expiresAt: new Date(Date.now() + 60_000),
      used: false,
      usedAt: null,
      createdAt: new Date()
    });

    const req = new NextRequest(`http://localhost/start?email=${CODE_EMAIL}&code=launch-code-123`);
    const res = await startGet(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/survey/day-21");
    expect(res.headers.get("set-cookie")).toContain("survey_session=");
  });

  it("creates a tracker record when a valid session cookie is present", async () => {
    const user = await getDb().collection("users").findOne({ email: TEST_EMAIL });
    const token = await createSurveySessionToken({
      userId: String(user?._id),
      surveyType: "nightly-recap"
    });

    const req = new NextRequest("http://localhost/api/tracker", {
      method: "POST",
      headers: { cookie: cookieHeader(token) }
    });

    const res = await trackerPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessionId).toBeTruthy();

    const tracker = await getDb().collection("surveyTrackers").findOne({
      userId: String(user?._id),
      sessionId: body.sessionId
    });

    expect(tracker).toBeTruthy();
    expect(tracker?.finalSubmitTime).toBeNull();
  });
});
