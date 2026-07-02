import { expect, test } from "@playwright/test";
import mongoose from "mongoose";

const MONGO_URI =
  process.env.E2E_MONGODB_URI ?? process.env.MONGODB_URI ?? "mongodb://localhost:27017/calmingbeats-survey-e2e";
const TEST_EMAIL = "e2e-survey-user@example.com";

async function resetDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB is not connected");

  await Promise.all([
    db.collection("users").deleteMany({ email: TEST_EMAIL }),
    db.collection("surveyTrackers").deleteMany({}),
    db.collection("surveyResponses").deleteMany({}),
    db.collection("surveyLaunchCodes").deleteMany({ email: TEST_EMAIL })
  ]);

  await db.collection("users").insertOne({
    email: TEST_EMAIL,
    token: [],
    createdAt: new Date()
  });
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

test("can start nightly recap, submit survey, and persist tracker + response", async ({ page }) => {
  await page.goto(`/start?email=${encodeURIComponent(TEST_EMAIL)}&surveyType=nightly-recap`);

  await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  await page.getByLabel("4 - Good").click();
  await page.getByRole("button", { name: "Submit Survey" }).click();

  await expect(page.getByText("Thank you!")).toBeVisible();

  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB is not connected");

  const user = await db.collection("users").findOne({ email: TEST_EMAIL });
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
  expect(tracker?.finalSubmitTime).toBeTruthy();
});
