// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMongo = vi.fn();
const userLean = vi.fn();
const userSelect = vi.fn(() => ({ lean: userLean }));
const userFindOne = vi.fn(() => ({ select: userSelect }));
const responseLean = vi.fn();
const responseSelect = vi.fn(() => ({ lean: responseLean }));
const responseFindOne = vi.fn(() => ({ select: responseSelect }));

vi.mock("@/lib/mongodb", () => ({
  connectMongo
}));

vi.mock("@/lib/models/User", () => ({
  UserModel: {
    findOne: userFindOne
  }
}));

vi.mock("@/lib/models/SurveyResponse", () => ({
  SurveyResponseModel: {
    findOne: responseFindOne
  }
}));

describe("auth helpers", () => {
  beforeEach(() => {
    connectMongo.mockResolvedValue(undefined);
    userFindOne.mockClear();
    userSelect.mockClear();
    userLean.mockClear();
    responseFindOne.mockClear();
    responseSelect.mockClear();
    responseLean.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes email by trimming and lowercasing", async () => {
    const { normalizeEmail } = await import("@/lib/auth");
    expect(normalizeEmail("  TEST@Example.COM ")).toBe("test@example.com");
  });

  it("returns the user id for a known email", async () => {
    userLean.mockResolvedValue({ _id: "abc123" });
    const { getUserIdByEmail } = await import("@/lib/auth");

    await expect(getUserIdByEmail("TEST@example.com")).resolves.toBe("abc123");
    expect(connectMongo).toHaveBeenCalled();
    expect(userFindOne).toHaveBeenCalledWith({ email: "test@example.com" });
  });

  it("throws for an unknown email", async () => {
    userLean.mockResolvedValue(null);
    const { getUserIdByEmail } = await import("@/lib/auth");

    await expect(getUserIdByEmail("missing@example.com")).rejects.toThrow(
      "User not found for email"
    );
  });

  it("detects whether a survey was already submitted", async () => {
    responseLean.mockResolvedValueOnce({ _id: "resp1" }).mockResolvedValueOnce(null);
    const { hasSubmittedSurvey } = await import("@/lib/auth");

    await expect(hasSubmittedSurvey("user-1", "day-7")).resolves.toBe(true);
    await expect(hasSubmittedSurvey("user-1", "day-14")).resolves.toBe(false);
  });
});
