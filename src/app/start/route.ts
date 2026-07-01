import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyLaunchCodeModel } from "@/lib/models/SurveyLaunchCode";
import { buildSessionSetCookieHeader, createSurveySessionToken } from "@/lib/session";
import { isSurveyType, SurveyType } from "@/lib/surveys";
import { extractBearerFromAuthHeader, verifyBackendBearerToken } from "@/lib/verifyToken";

function readSurveyType(input: string | null | undefined): SurveyType {
  if (input && isSurveyType(input)) {
    return input;
  }
  return "nightly-recap";
}

function buildTargetPath(req: NextRequest, surveyType: SurveyType): string {
  const src = req.nextUrl.searchParams;
  const params = new URLSearchParams();

  for (const key of ["calmScore", "interventionCount", "userSegment", "variant"]) {
    const value = src.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  if (!params.has("sessionSeed")) {
    params.set("sessionSeed", randomUUID());
  }

  const search = params.toString();
  return `/survey/${surveyType}${search ? `?${search}` : ""}`;
}

async function redeemLaunchCode(code: string): Promise<string> {
  await connectMongo();
  const doc = await SurveyLaunchCodeModel.findOneAndUpdate(
    {
      code,
      used: false,
      expiresAt: { $gt: new Date() }
    },
    {
      $set: { used: true, usedAt: new Date() }
    },
    { new: true }
  ).lean();

  if (!doc?.userId) {
    throw new Error("Invalid or expired launch code");
  }

  return doc.userId;
}

async function resolveUserId(req: NextRequest, bodyCode?: string | null): Promise<string> {
  const bearer = extractBearerFromAuthHeader(req.headers.get("authorization"));
  if (bearer) {
    const verified = await verifyBackendBearerToken(bearer);
    return verified.userId;
  }

  const queryCode = req.nextUrl.searchParams.get("code");
  const code = (bodyCode ?? queryCode)?.trim();
  if (!code) {
    throw new Error("Missing Authorization Bearer token or launch code");
  }

  return redeemLaunchCode(code);
}

export async function GET(req: NextRequest) {
  try {
    const surveyType = readSurveyType(req.nextUrl.searchParams.get("type"));
    const userId = await resolveUserId(req);
    const sessionToken = await createSurveySessionToken(userId);
    const redirectPath = buildTargetPath(req, surveyType);
    const redirectUrl = new URL(redirectPath, req.nextUrl.origin);

    const res = NextResponse.redirect(redirectUrl);
    res.headers.append("Set-Cookie", buildSessionSetCookieHeader(sessionToken));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; type?: string };
    const surveyType = readSurveyType(body.type ?? req.nextUrl.searchParams.get("type"));
    const userId = await resolveUserId(req, body.code ?? null);
    const sessionToken = await createSurveySessionToken(userId);
    const redirectPath = buildTargetPath(req, surveyType);

    const res = NextResponse.json({ ok: true, redirectPath });
    res.headers.append("Set-Cookie", buildSessionSetCookieHeader(sessionToken));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
