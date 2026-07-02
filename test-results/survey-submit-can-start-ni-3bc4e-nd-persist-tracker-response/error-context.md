# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: survey-submit.spec.ts >> can start nightly recap, submit survey, and persist tracker + response
- Location: tests\e2e\survey-submit.spec.ts:38:5

# Error details

```
MongooseServerSelectionError: connect ECONNREFUSED ::1:27017, connect ECONNREFUSED 127.0.0.1:27017
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import mongoose from "mongoose";
  3  | 
  4  | const MONGO_URI =
  5  |   process.env.E2E_MONGODB_URI ?? process.env.MONGODB_URI ?? "mongodb://localhost:27017/calmingbeats-survey-e2e";
  6  | const TEST_EMAIL = "e2e-survey-user@example.com";
  7  | 
  8  | async function resetDb() {
  9  |   const db = mongoose.connection.db;
  10 |   if (!db) throw new Error("Mongo DB is not connected");
  11 | 
  12 |   await Promise.all([
  13 |     db.collection("users").deleteMany({ email: TEST_EMAIL }),
  14 |     db.collection("surveyTrackers").deleteMany({}),
  15 |     db.collection("surveyResponses").deleteMany({}),
  16 |     db.collection("surveyLaunchCodes").deleteMany({ email: TEST_EMAIL })
  17 |   ]);
  18 | 
  19 |   await db.collection("users").insertOne({
  20 |     email: TEST_EMAIL,
  21 |     token: [],
  22 |     createdAt: new Date()
  23 |   });
  24 | }
  25 | 
  26 | test.beforeAll(async () => {
> 27 |   await mongoose.connect(MONGO_URI);
     |   ^ MongooseServerSelectionError: connect ECONNREFUSED ::1:27017, connect ECONNREFUSED 127.0.0.1:27017
  28 | });
  29 | 
  30 | test.beforeEach(async () => {
  31 |   await resetDb();
  32 | });
  33 | 
  34 | test.afterAll(async () => {
  35 |   await mongoose.disconnect();
  36 | });
  37 | 
  38 | test("can start nightly recap, submit survey, and persist tracker + response", async ({ page }) => {
  39 |   await page.goto(`/start?email=${encodeURIComponent(TEST_EMAIL)}&surveyType=nightly-recap`);
  40 | 
  41 |   await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  42 |   await page.getByLabel("4 - Good").click();
  43 |   await page.getByRole("button", { name: "Submit Survey" }).click();
  44 | 
  45 |   await expect(page.getByText("Thank you!")).toBeVisible();
  46 | 
  47 |   const db = mongoose.connection.db;
  48 |   if (!db) throw new Error("Mongo DB is not connected");
  49 | 
  50 |   const user = await db.collection("users").findOne({ email: TEST_EMAIL });
  51 |   expect(user?._id).toBeTruthy();
  52 | 
  53 |   const response = await db.collection("surveyResponses").findOne({
  54 |     userId: String(user?._id),
  55 |     surveyType: "nightly-recap"
  56 |   });
  57 | 
  58 |   expect(response).toBeTruthy();
  59 |   expect(response?.responses).toEqual(
  60 |     expect.arrayContaining([
  61 |       expect.objectContaining({ questionId: "q1", answer: "4 - Good" })
  62 |     ])
  63 |   );
  64 | 
  65 |   const tracker = await db.collection("surveyTrackers").findOne({
  66 |     userId: String(user?._id),
  67 |     sessionId: response?.sessionId
  68 |   });
  69 | 
  70 |   expect(tracker).toBeTruthy();
  71 |   expect(tracker?.finalSubmitTime).toBeTruthy();
  72 | });
  73 | 
```