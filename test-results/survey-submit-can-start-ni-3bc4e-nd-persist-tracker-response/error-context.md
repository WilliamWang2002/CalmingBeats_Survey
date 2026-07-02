# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: survey-submit.spec.ts >> can start nightly recap, submit survey, and persist tracker + response
- Location: tests\e2e\survey-submit.spec.ts:39:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('div').filter({ hasText: '4 - Good' }).locator('xpath=ancestor::div[contains(@class,\'cursor-pointer\')][1]')

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import mongoose from "mongoose";
  3  | 
  4  | const MONGO_URI =
  5  |   process.env.E2E_MONGODB_URI ??
  6  |   "mongodb://localhost:27017/calmingbeats-dev?replicaSet=rs0&directConnection=true";
  7  | const TEST_EMAIL = "e2e-survey-user@example.com";
  8  | 
  9  | async function resetDb() {
  10 |   const db = mongoose.connection.db;
  11 |   if (!db) throw new Error("Mongo DB is not connected");
  12 | 
  13 |   await Promise.all([
  14 |     db.collection("users").deleteMany({ email: TEST_EMAIL }),
  15 |     db.collection("surveyTrackers").deleteMany({}),
  16 |     db.collection("surveyResponses").deleteMany({}),
  17 |     db.collection("surveyLaunchCodes").deleteMany({ email: TEST_EMAIL })
  18 |   ]);
  19 | 
  20 |   await db.collection("users").insertOne({
  21 |     email: TEST_EMAIL,
  22 |     token: [],
  23 |     createdAt: new Date()
  24 |   });
  25 | }
  26 | 
  27 | test.beforeAll(async () => {
  28 |   await mongoose.connect(MONGO_URI);
  29 | });
  30 | 
  31 | test.beforeEach(async () => {
  32 |   await resetDb();
  33 | });
  34 | 
  35 | test.afterAll(async () => {
  36 |   await mongoose.disconnect();
  37 | });
  38 | 
  39 | test("can start nightly recap, submit survey, and persist tracker + response", async ({ page }) => {
  40 |   await page.goto(`/start?email=${encodeURIComponent(TEST_EMAIL)}&surveyType=nightly-recap`);
  41 | 
  42 |   await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  43 |   await expect(page.getByText("Initializing...")).toHaveCount(0);
  44 | 
  45 |   // Nightly recap has one single-select question; choose the 4th option: "4 - Good".
  46 |   await page
  47 |     .locator("div", { hasText: "4 - Good" })
  48 |     .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')][1]")
> 49 |     .click();
     |      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  50 | 
  51 |   const submitButton = page.getByRole("button", { name: "Submit Survey" });
  52 |   await expect(submitButton).toBeEnabled();
  53 |   await submitButton.click();
  54 | 
  55 |   await expect(page.getByText("Thank you!")).toBeVisible();
  56 | 
  57 |   const db = mongoose.connection.db;
  58 |   if (!db) throw new Error("Mongo DB is not connected");
  59 | 
  60 |   const user = await db.collection("users").findOne({ email: TEST_EMAIL });
  61 |   expect(user?._id).toBeTruthy();
  62 | 
  63 |   const response = await db.collection("surveyResponses").findOne({
  64 |     userId: String(user?._id),
  65 |     surveyType: "nightly-recap"
  66 |   });
  67 | 
  68 |   expect(response).toBeTruthy();
  69 |   expect(response?.responses).toEqual(
  70 |     expect.arrayContaining([
  71 |       expect.objectContaining({ questionId: "q1", answer: "4 - Good" })
  72 |     ])
  73 |   );
  74 | 
  75 |   const tracker = await db.collection("surveyTrackers").findOne({
  76 |     userId: String(user?._id),
  77 |     sessionId: response?.sessionId
  78 |   });
  79 | 
  80 |   expect(tracker).toBeTruthy();
  81 |   expect(tracker?.finalSubmitTime).toBeTruthy();
  82 | });
  83 | 
```