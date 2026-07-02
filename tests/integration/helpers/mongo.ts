// @vitest-environment node

import mongoose from "mongoose";

export const TEST_MONGO_URI =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017/calmingbeats-dev?replicaSet=rs0&directConnection=true";

export async function connectTestMongo() {
  process.env.MONGODB_URI = TEST_MONGO_URI;
  process.env.SESSION_SECRET ??= "integration-test-secret";

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  await mongoose.connect(TEST_MONGO_URI);
  return mongoose;
}

export function getDb() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Mongo DB is not connected");
  }
  return db;
}

export async function disconnectTestMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function resetTestData(emails: string[]) {
  const db = getDb();

  const users = await db
    .collection("users")
    .find({ email: { $in: emails } }, { projection: { _id: 1, email: 1 } })
    .toArray();

  const userIds = users.map((user) => String(user._id));

  await Promise.all([
    db.collection("surveyTrackers").deleteMany({
      $or: [{ userId: { $in: userIds } }, { userId: { $in: emails } }]
    }),
    db.collection("surveyResponses").deleteMany({
      $or: [{ userId: { $in: userIds } }, { userId: { $in: emails } }]
    }),
    db.collection("surveyLaunchCodes").deleteMany({ email: { $in: emails } }),
    db.collection("users").deleteMany({ email: { $in: emails } })
  ]);
}

export async function seedUser(email: string) {
  const db = getDb();

  const result = await db.collection("users").insertOne({
    email,
    token: [],
    createdAt: new Date()
  });

  return String(result.insertedId);
}
