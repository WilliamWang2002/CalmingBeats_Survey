import { jwtVerify, SignJWT } from "jose";
import { parse, serialize } from "cookie";
import { NextRequest } from "next/server";
import { SurveyType } from "@/lib/surveys";

const COOKIE_NAME = "survey_session";

export type SurveySessionPayload = {
  userId: string;
  surveyType?: SurveyType;
  launchCode?: string;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSurveySessionToken(payload: SurveySessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export function buildSessionSetCookieHeader(token: string): string {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getSurveySessionFromRequest(req: NextRequest): Promise<SurveySessionPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) {
    throw new Error("Missing survey session cookie");
  }

  const { payload } = await jwtVerify(token, getSessionSecret());
  const userId = String(payload.userId ?? "");
  if (!userId) {
    throw new Error("Invalid survey session payload");
  }

  return {
    userId,
    surveyType: payload.surveyType ? (String(payload.surveyType) as SurveyType) : undefined,
    launchCode: payload.launchCode ? String(payload.launchCode) : undefined
  };
}

export async function getSessionUserIdFromRequest(req: NextRequest): Promise<string> {
  const session = await getSurveySessionFromRequest(req);
  return session.userId;
}
