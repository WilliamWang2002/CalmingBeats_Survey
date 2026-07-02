import mongoose, { Model, Schema } from "mongoose";

export type BackendUser = {
  _id: string;
  email: string;
  token: string[];
};

const UserSchema = new Schema<BackendUser>(
  {
    email: { type: String },
    token: { type: [String], default: [] }
  },
  {
    versionKey: false,
    strict: false,
    collection: "users"
  }
);

export const UserModel: Model<BackendUser> =
  mongoose.models.User || mongoose.model<BackendUser>("User", UserSchema);
