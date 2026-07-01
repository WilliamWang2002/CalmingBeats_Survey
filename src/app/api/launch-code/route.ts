import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { SurveyLaunchCodeModel } from "@/lib/models/SurveyLaunchCode";
import { extractBearerFromAuthHeader, verifyBackendBearerToken } from "@/lib/verifyToken";

export async function POST(req: NextRequest) {
  try {
    const bearer = extractBearerFromAuthHeader(req.headers.get("authorization"));
    if (!bearer) {
      return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
    }

    const { userId } = await verifyBackendBearerToken(bearer);
    await connectMongo();

    const code = randomBytes(18).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 1000);
    await SurveyLaunchCodeModel.create({
      code,
      userId,
      expiresAt,
      used: false,
      usedAt: null,
      createdAt: new Date()
    });

    return NextResponse.json({ code, expiresInSec: 60 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create launch code" },
      { status: 401 }
    );
  }
}
