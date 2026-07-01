import { jwtVerify, JWTPayload } from "jose";
import { connectMongo } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

type VerifyResult = {
  userId: string;
  token: string;
  payload: JWTPayload;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyBackendBearerToken(bearerToken: string): Promise<VerifyResult> {
  const token = bearerToken.trim();
  if (!token) {
    throw new Error("Missing token");
  }

  const { payload } = await jwtVerify(token, getSecret());
  const userId = String(payload.userId ?? "");
  if (!userId) {
    throw new Error("Invalid token payload: userId missing");
  }

  await connectMongo();
  const user = await UserModel.findById(userId).select({ token: 1 }).lean();
  const activeTokens = Array.isArray(user?.token) ? user.token : [];
  if (!activeTokens.includes(token)) {
    throw new Error("Token is no longer active");
  }

  return { userId, token, payload };
}

export function extractBearerFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}
