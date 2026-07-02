# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: survey-submit.spec.ts >> webview-style start route can submit nightly recap and persist data
- Location: tests\e2e\survey-submit.spec.ts:58:5

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  getByRole('button', { name: 'Submit Survey' })
Expected: enabled
Received: disabled
Timeout:  5000ms

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Submit Survey' })
    14 × locator resolved to <button disabled tabindex="0" type="button" data-disabled="" data-slot="button" data-testid="submit-survey" class="group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid…>Submit Survey</button>
       - unexpected value "disabled"

```

```yaml
- button "Submit Survey" [disabled]
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import mongoose from "mongoose";
  3   | 
  4   | const MONGO_URI =
  5   |   process.env.E2E_MONGODB_URI ??
  6   |   "mongodb://localhost:27017/calmingbeats-dev?replicaSet=rs0&directConnection=true";
  7   | const BASE_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;
  8   | const WEBVIEW_EMAIL = "e2e-survey-user@example.com";
  9   | const LAUNCH_CODE_EMAIL = "e2e-launch-code-user@example.com";
  10  | 
  11  | function extractSurveySessionCookie(setCookieHeader: string | undefined) {
  12  |   const match = setCookieHeader?.match(/survey_session=([^;]+)/);
  13  |   if (!match) {
  14  |     throw new Error("Missing survey_session cookie in Set-Cookie header");
  15  |   }
  16  |   return match[1];
  17  | }
  18  | 
  19  | async function resetDb() {
  20  |   const db = mongoose.connection.db;
  21  |   if (!db) throw new Error("Mongo DB is not connected");
  22  | 
  23  |   await Promise.all([
  24  |     db.collection("surveyTrackers").deleteMany({}),
  25  |     db.collection("surveyResponses").deleteMany({}),
  26  |     db.collection("surveyLaunchCodes").deleteMany({
  27  |       email: { $in: [WEBVIEW_EMAIL, LAUNCH_CODE_EMAIL] }
  28  |     }),
  29  |     db.collection("users").deleteMany({ email: { $in: [WEBVIEW_EMAIL, LAUNCH_CODE_EMAIL] } })
  30  |   ]);
  31  | 
  32  |   await db.collection("users").insertMany([
  33  |     {
  34  |       email: WEBVIEW_EMAIL,
  35  |       token: [],
  36  |       createdAt: new Date()
  37  |     },
  38  |     {
  39  |       email: LAUNCH_CODE_EMAIL,
  40  |       token: [],
  41  |       createdAt: new Date()
  42  |     }
  43  |   ]);
  44  | }
  45  | 
  46  | test.beforeAll(async () => {
  47  |   await mongoose.connect(MONGO_URI);
  48  | });
  49  | 
  50  | test.beforeEach(async () => {
  51  |   await resetDb();
  52  | });
  53  | 
  54  | test.afterAll(async () => {
  55  |   await mongoose.disconnect();
  56  | });
  57  | 
  58  | test("webview-style start route can submit nightly recap and persist data", async ({ page, request }) => {
  59  |   const startResponse = await request.get(
  60  |     `/start?email=${encodeURIComponent(WEBVIEW_EMAIL)}&surveyType=nightly-recap`,
  61  |     { maxRedirects: 0 }
  62  |   );
  63  |   expect(startResponse.status()).toBe(307);
  64  | 
  65  |   const sessionCookie = extractSurveySessionCookie(startResponse.headers()["set-cookie"]);
  66  |   const location = startResponse.headers()["location"];
  67  | 
  68  |   await page.context().addCookies([
  69  |     {
  70  |       name: "survey_session",
  71  |       value: sessionCookie,
  72  |       url: BASE_URL,
  73  |       httpOnly: true,
  74  |       sameSite: "Lax"
  75  |     }
  76  |   ]);
  77  | 
  78  |   await page.goto(location);
  79  |   await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  80  |   await expect(page.getByText("Initializing...")).toHaveCount(0);
  81  | 
  82  |   await page.getByTestId("q1-option-3").click();
  83  | 
  84  |   const submitButton = page.getByRole("button", { name: "Submit Survey" });
> 85  |   await expect(submitButton).toBeEnabled();
      |                              ^ Error: expect(locator).toBeEnabled() failed
  86  |   await submitButton.click();
  87  | 
  88  |   await expect(page.getByText("Thank you!")).toBeVisible();
  89  | 
  90  |   const db = mongoose.connection.db;
  91  |   if (!db) throw new Error("Mongo DB is not connected");
  92  | 
  93  |   const user = await db.collection("users").findOne({ email: WEBVIEW_EMAIL });
  94  |   expect(user?._id).toBeTruthy();
  95  | 
  96  |   const response = await db.collection("surveyResponses").findOne({
  97  |     userId: String(user?._id),
  98  |     surveyType: "nightly-recap"
  99  |   });
  100 | 
  101 |   expect(response).toBeTruthy();
  102 |   expect(response?.responses).toEqual(
  103 |     expect.arrayContaining([
  104 |       expect.objectContaining({ questionId: "q1", answer: "4 - Good" })
  105 |     ])
  106 |   );
  107 | 
  108 |   const tracker = await db.collection("surveyTrackers").findOne({
  109 |     userId: String(user?._id),
  110 |     sessionId: response?.sessionId
  111 |   });
  112 | 
  113 |   expect(tracker).toBeTruthy();
  114 |   expect(tracker?.surveyType).toBe("nightly-recap");
  115 |   expect(tracker?.finalSubmitTime).toBeTruthy();
  116 | });
  117 | 
  118 | test("launch-code email flow can redeem code, submit survey, and mark code used", async ({ page, request }) => {
  119 |   const codeResponse = await request.post("/api/launch-code", {
  120 |     data: {
  121 |       email: LAUNCH_CODE_EMAIL,
  122 |       surveyType: "nightly-recap"
  123 |     }
  124 |   });
  125 |   expect(codeResponse.ok()).toBe(true);
  126 |   const codeBody = await codeResponse.json();
  127 | 
  128 |   const startResponse = await request.get(
  129 |     `/start?email=${encodeURIComponent(LAUNCH_CODE_EMAIL)}&code=${encodeURIComponent(codeBody.code)}`
  130 |     , { maxRedirects: 0 }
  131 |   );
  132 |   expect(startResponse.status()).toBe(307);
  133 | 
  134 |   const sessionCookie = extractSurveySessionCookie(startResponse.headers()["set-cookie"]);
  135 |   const location = startResponse.headers()["location"];
  136 | 
  137 |   await page.context().addCookies([
  138 |     {
  139 |       name: "survey_session",
  140 |       value: sessionCookie,
  141 |       url: BASE_URL,
  142 |       httpOnly: true,
  143 |       sameSite: "Lax"
  144 |     }
  145 |   ]);
  146 | 
  147 |   await page.goto(location);
  148 |   await expect(page).toHaveURL(/\/survey\/nightly-recap/);
  149 |   await expect(page.getByText("Initializing...")).toHaveCount(0);
  150 |   await page.getByTestId("q1-option-4").click();
  151 | 
  152 |   const submitButton = page.getByRole("button", { name: "Submit Survey" });
  153 |   await expect(submitButton).toBeEnabled();
  154 |   await submitButton.click();
  155 | 
  156 |   await expect(page.getByText("Thank you!")).toBeVisible();
  157 | 
  158 |   const db = mongoose.connection.db;
  159 |   if (!db) throw new Error("Mongo DB is not connected");
  160 | 
  161 |   const user = await db.collection("users").findOne({ email: LAUNCH_CODE_EMAIL });
  162 |   const response = await db.collection("surveyResponses").findOne({
  163 |     userId: String(user?._id),
  164 |     surveyType: "nightly-recap"
  165 |   });
  166 |   const launchCode = await db.collection("surveyLaunchCodes").findOne({ code: codeBody.code });
  167 | 
  168 |   expect(response).toBeTruthy();
  169 |   expect(launchCode?.used).toBe(true);
  170 |   expect(launchCode?.usedAt).toBeTruthy();
  171 | });
  172 | 
```