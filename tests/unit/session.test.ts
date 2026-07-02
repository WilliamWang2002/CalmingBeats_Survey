// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSessionSetCookieHeader,
  createSurveySessionToken,
  getSessionUserIdFromRequest,
  getSurveySessionFromRequest
} from "@/lib/session";

describe("session helpers", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "unit-test-session-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSecret;
    }
    vi.restoreAllMocks();
  });

  it("creates and decodes a survey session token", async () => {
    const token = await createSurveySessionToken({
      userId: "user-123",
      surveyType: "day-7",
      launchCode: "code-abc"
    });

    const req = new NextRequest("http://localhost/test", {
      headers: { cookie: `survey_session=${token}` }
    });

    await expect(getSurveySessionFromRequest(req)).resolves.toEqual({
      userId: "user-123",
      surveyType: "day-7",
      launchCode: "code-abc"
    });
    await expect(getSessionUserIdFromRequest(req)).resolves.toBe("user-123");
  });

  it("builds an httpOnly session cookie header", async () => {
    const token = await createSurveySessionToken({ userId: "user-123" });
    const cookieHeader = buildSessionSetCookieHeader(token);

    expect(cookieHeader).toContain("survey_session=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Lax");
    expect(cookieHeader).toContain("Path=/");
  });

  it("throws when the session cookie is missing", async () => {
    const req = new NextRequest("http://localhost/test");
    await expect(getSurveySessionFromRequest(req)).rejects.toThrow(
      "Missing survey session cookie"
    );
  });

  it("throws when the token is invalid", async () => {
    const req = new NextRequest("http://localhost/test", {
      headers: { cookie: "survey_session=not-a-real-token" }
    });

    await expect(getSurveySessionFromRequest(req)).rejects.toThrow();
  });

  it("throws when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;

    await expect(createSurveySessionToken({ userId: "user-123" })).rejects.toThrow(
      "SESSION_SECRET is not configured"
    );
  });
});
