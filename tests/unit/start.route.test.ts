// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMongo = vi.fn();
const findOneLean = vi.fn();
const findOne = vi.fn(() => ({ lean: findOneLean }));
const createSurveySessionToken = vi.fn();
const buildSessionSetCookieHeader = vi.fn();
const getUserIdByEmail = vi.fn();
const hasSubmittedSurvey = vi.fn();

vi.mock("@/lib/mongodb", () => ({ connectMongo }));
vi.mock("@/lib/models/SurveyLaunchCode", () => ({
  SurveyLaunchCodeModel: { findOne }
}));
vi.mock("@/lib/session", () => ({
  createSurveySessionToken,
  buildSessionSetCookieHeader
}));
vi.mock("@/lib/auth", () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  getUserIdByEmail,
  hasSubmittedSurvey
}));

describe("/start route unit", () => {
  beforeEach(() => {
    connectMongo.mockResolvedValue(undefined);
    findOne.mockClear();
    findOneLean.mockClear();
    createSurveySessionToken.mockResolvedValue("session-token");
    buildSessionSetCookieHeader.mockReturnValue("survey_session=session-token; Path=/; HttpOnly");
    getUserIdByEmail.mockResolvedValue("user-123");
    hasSubmittedSurvey.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects email+surveyType requests to the survey path and sets a cookie", async () => {
    const { GET } = await import("@/app/start/route");
    const req = new NextRequest("http://localhost/start?email=test@example.com&surveyType=day-14");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/survey/day-14");
    expect(res.headers.get("set-cookie")).toContain("survey_session=session-token");
    expect(createSurveySessionToken).toHaveBeenCalledWith({
      userId: "user-123",
      surveyType: "day-14",
      launchCode: undefined
    });
  });

  it("uses the launch-code survey type when code is present", async () => {
    findOneLean.mockResolvedValue({ surveyType: "day-21" });
    const { GET } = await import("@/app/start/route");
    const req = new NextRequest("http://localhost/start?email=test@example.com&code=abc123");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/survey/day-21");
    expect(findOne).toHaveBeenCalled();
  });

  it("returns 401 when email is missing", async () => {
    const { GET } = await import("@/app/start/route");
    const req = new NextRequest("http://localhost/start?surveyType=day-7");

    const res = await GET(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Missing email" });
  });

  it("redirects to already-submitted page when the survey was already submitted", async () => {
    hasSubmittedSurvey.mockResolvedValue(true);
    const { GET } = await import("@/app/start/route");
    const req = new NextRequest("http://localhost/start?email=test@example.com&surveyType=day-7");

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/already-submitted?surveyType=day-7");
  });
});
