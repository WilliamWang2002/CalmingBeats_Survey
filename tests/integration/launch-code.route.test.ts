// @vitest-environment node

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/launch-code/route";
import { connectTestMongo, disconnectTestMongo, getDb, resetTestData, seedUser } from "./helpers/mongo";

const TEST_EMAIL = "integration-launch@example.com";

describe("POST /api/launch-code", () => {
  beforeAll(async () => {
    await connectTestMongo();
  });

  beforeEach(async () => {
    await resetTestData([TEST_EMAIL]);
    await seedUser(TEST_EMAIL);
  });

  afterAll(async () => {
    await disconnectTestMongo();
  });

  it("creates a one-time launch code document", async () => {
    const req = new NextRequest("http://localhost/api/launch-code", {
      method: "POST",
      body: JSON.stringify({ email: TEST_EMAIL, surveyType: "day-7" }),
      headers: { "content-type": "application/json" }
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.email).toBe(TEST_EMAIL);
    expect(body.surveyType).toBe("day-7");
    expect(body.expiresInSec).toBe(600);
    expect(body.code).toMatch(/^[a-f0-9]{36}$/);

    const doc = await getDb()
      .collection("surveyLaunchCodes")
      .findOne({ code: body.code });

    expect(doc).toBeTruthy();
    expect(doc?.email).toBe(TEST_EMAIL);
    expect(doc?.used).toBe(false);
  });

  it("returns 409 when the survey was already submitted", async () => {
    const user = await getDb().collection("users").findOne({ email: TEST_EMAIL });
    await getDb().collection("surveyResponses").insertOne({
      userId: String(user?._id),
      sessionId: "existing-session",
      surveyType: "day-7",
      responses: [],
      submittedAt: new Date(),
      createdAt: new Date()
    });

    const req = new NextRequest("http://localhost/api/launch-code", {
      method: "POST",
      body: JSON.stringify({ email: TEST_EMAIL, surveyType: "day-7" }),
      headers: { "content-type": "application/json" }
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Survey already submitted" });
  });
});
