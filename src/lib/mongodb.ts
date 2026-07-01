import mongoose from "mongoose";

declare global {
  var __mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cache = global.__mongooseConn ?? { conn: null, promise: null };
global.__mongooseConn = cache;

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: undefined
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
