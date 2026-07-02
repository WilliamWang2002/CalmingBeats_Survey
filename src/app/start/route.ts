import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyLaunchCodeModel } from "@/lib/models/SurveyLaunchCode";
import { buildSessionSetCookieHeader, createSurveySessionToken } from "@/lib/session";
import { isSurveyType, SurveyType } from "@/lib/surveys";
import { getUserIdByEmail, hasSubmittedSurvey, normalizeEmail } from "@/lib/auth";

class SurveyAlreadySubmittedError extends Error {
  surveyType: SurveyType;

  constructor(surveyType: SurveyType) {
    super("Survey already submitted");
    this.surveyType = surveyType;
  }
}

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

function buildAlreadySubmittedPath(surveyType: SurveyType): string {
  const params = new URLSearchParams({ surveyType });
  return `/already-submitted?${params.toString()}`;
}

async function readEmail(req: NextRequest, bodyEmail?: string | null): Promise<string> {
  const queryEmail = req.nextUrl.searchParams.get("email");
  const email = normalizeEmail(String(bodyEmail ?? queryEmail ?? ""));
  if (!email) {
    throw new Error("Missing email");
  }
  return email;
}

async function resolveLaunchCode(code: string, email: string): Promise<{ surveyType: SurveyType }> {
  await connectMongo();
  const doc = await SurveyLaunchCodeModel.findOne(
    {
      code,
      email,
      used: false,
      expiresAt: { $gt: new Date() }
    },
    { surveyType: 1 }
  ).lean();

  if (!doc?.surveyType) {
    throw new Error("Invalid or expired launch code");
  }

  return { surveyType: doc.surveyType };
}

async function readCode(req: NextRequest, bodyCode?: string | null): Promise<string | undefined> {
  const queryCode = req.nextUrl.searchParams.get("code");
  const code = (bodyCode ?? queryCode)?.trim();
  return code || undefined;
}

async function resolveStart(req: NextRequest, explicitSurveyType: SurveyType | undefined, body?: { email?: string; code?: string }) {
  const email = await readEmail(req, body?.email ?? null);
  const code = await readCode(req, body?.code ?? null);
  let surveyType = explicitSurveyType ?? readSurveyType(undefined);

  if (code) {
    const launch = await resolveLaunchCode(code, email);
    surveyType = launch.surveyType;
  }

  const userId = await getUserIdByEmail(email);
  const alreadySubmitted = await hasSubmittedSurvey(userId, surveyType);
  if (alreadySubmitted) {
    throw new SurveyAlreadySubmittedError(surveyType);
  }

  return { userId, code, surveyType };
}

export async function GET(req: NextRequest) {
  try {
    const surveyTypeInput = req.nextUrl.searchParams.get("surveyType") ?? req.nextUrl.searchParams.get("type");
    const explicitSurveyType = surveyTypeInput ? readSurveyType(surveyTypeInput) : undefined;
    const { userId, code, surveyType } = await resolveStart(req, explicitSurveyType);
    const sessionToken = await createSurveySessionToken({
      userId,
      surveyType,
      launchCode: code
    });
    const redirectPath = buildTargetPath(req, surveyType);
    const redirectUrl = new URL(redirectPath, req.nextUrl.origin);

    const res = NextResponse.redirect(redirectUrl);
    res.headers.append("Set-Cookie", buildSessionSetCookieHeader(sessionToken));
    return res;
  } catch (error) {
    if (error instanceof SurveyAlreadySubmittedError) {
      const redirectUrl = new URL(buildAlreadySubmittedPath(error.surveyType), req.nextUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; type?: string; surveyType?: string; email?: string };
    const surveyTypeInput = body.surveyType ?? body.type ?? req.nextUrl.searchParams.get("surveyType") ?? req.nextUrl.searchParams.get("type");
    const explicitSurveyType = surveyTypeInput ? readSurveyType(surveyTypeInput) : undefined;
    const { userId, code, surveyType } = await resolveStart(req, explicitSurveyType, body);
    const sessionToken = await createSurveySessionToken({
      userId,
      surveyType,
      launchCode: code
    });
    const redirectPath = buildTargetPath(req, surveyType);

    const res = NextResponse.json({ ok: true, redirectPath });
    res.headers.append("Set-Cookie", buildSessionSetCookieHeader(sessionToken));
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Survey already submitted" ? 409 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
