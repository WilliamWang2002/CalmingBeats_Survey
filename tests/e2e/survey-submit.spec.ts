import { expect, test } from "@playwright/test";
import mongoose from "mongoose";

const MONGO_URI =
  process.env.E2E_MONGODB_URI ??
  "mongodb://localhost:27017/calmingbeats-dev?replicaSet=rs0&directConnection=true";
const BASE_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;
const WEBVIEW_EMAIL = "e2e-survey-user@example.com";
const LAUNCH_CODE_EMAIL = "e2e-launch-code-user@example.com";

function extractSurveySessionCookie(setCookieHeader: string | undefined) {
  const match = setCookieHeader?.match(/survey_session=([^;]+)/);
  if (!match) {
    throw new Error("Missing survey_session cookie in Set-Cookie header");
  }
  return match[1];
}

async function resetDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB is not connected");

  await Promise.all([
    db.collection("surveyTrackers").deleteMany({}),
    db.collection("surveyResponses").deleteMany({}),
    db.collection("surveyLaunchCodes").deleteMany({
      email: { $in: [WEBVIEW_EMAIL, LAUNCH_CODE_EMAIL] }
    }),
    db.collection("users").deleteMany({ email: { $in: [WEBVIEW_EMAIL, LAUNCH_CODE_EMAIL] } })
  ]);

  await db.collection("users").insertMany([
    {
      email: WEBVIEW_EMAIL,
      token: [],
      createdAt: new Date()
    },
    {
      email: LAUNCH_CODE_EMAIL,
      token: [],
      createdAt: new Date()
    }
  ]);
}

test.beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await mongoose.disconnect();
});

test("webview-style start route can submit nightly recap and persist data", async ({ page, request }) => {
  const startResponse = await request.get(
    `/start?email=${encodeURIComponent(WEBVIEW_EMAIL)}&surveyType=nightly-recap`,
    { maxRedirects: 0 }
  );
  expect(startResponse.status()).toBe(307);

  const sessionCookie = extractSurveySessionCookie(startResponse.headers()["set-cookie"]);
  const location = startResponse.headers()["location"];

  await page.context().addCookies([
    {
      name: "survey_session",
      value: sessionCookie,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  await page.goto(location);
  await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  await expect(page.getByText("Initializing...")).toHaveCount(0);

  await page.getByTestId("q1-option-3").click();

  const submitButton = page.getByRole("button", { name: "Submit Survey" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText("Thank you!")).toBeVisible();

  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB is not connected");

  const user = await db.collection("users").findOne({ email: WEBVIEW_EMAIL });
  expect(user?._id).toBeTruthy();

  const response = await db.collection("surveyResponses").findOne({
    userId: String(user?._id),
    surveyType: "nightly-recap"
  });

  expect(response).toBeTruthy();
  expect(response?.responses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ questionId: "q1", answer: "4 - Good" })
    ])
  );

  const tracker = await db.collection("surveyTrackers").findOne({
    userId: String(user?._id),
    sessionId: response?.sessionId
  });

  expect(tracker).toBeTruthy();
  expect(tracker?.surveyType).toBe("nightly-recap");
  expect(tracker?.finalSubmitTime).toBeTruthy();
});

test("launch-code email flow can redeem code, submit survey, and mark code used", async ({ page, request }) => {
  const codeResponse = await request.post("/api/launch-code", {
    data: {
      email: LAUNCH_CODE_EMAIL,
      surveyType: "nightly-recap"
    }
  });
  expect(codeResponse.ok()).toBe(true);
  const codeBody = await codeResponse.json();

  const startResponse = await request.get(
    `/start?email=${encodeURIComponent(LAUNCH_CODE_EMAIL)}&code=${encodeURIComponent(codeBody.code)}`
    , { maxRedirects: 0 }
  );
  expect(startResponse.status()).toBe(307);

  const sessionCookie = extractSurveySessionCookie(startResponse.headers()["set-cookie"]);
  const location = startResponse.headers()["location"];

  await page.context().addCookies([
    {
      name: "survey_session",
      value: sessionCookie,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  await page.goto(location);
  await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  await expect(page.getByText("Initializing...")).toHaveCount(0);
  await page.getByTestId("q1-option-4").click();

  const submitButton = page.getByRole("button", { name: "Submit Survey" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText("Thank you!")).toBeVisible();

  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB is not connected");

  const user = await db.collection("users").findOne({ email: LAUNCH_CODE_EMAIL });
  const response = await db.collection("surveyResponses").findOne({
    userId: String(user?._id),
    surveyType: "nightly-recap"
  });
  const launchCode = await db.collection("surveyLaunchCodes").findOne({ code: codeBody.code });

  expect(response).toBeTruthy();
  expect(launchCode?.used).toBe(true);
  expect(launchCode?.usedAt).toBeTruthy();
});
