import { NextResponse } from "next/server";
import { openApiSpec } from "@/swagger/spec";

export async function GET() {
  return NextResponse.json(openApiSpec);
}
