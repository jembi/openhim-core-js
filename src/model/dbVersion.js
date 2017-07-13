import { Schema } from "mongoose";
import { connectionAPI } from "../config";
import { connectionDefault } from "../config";

const dbVersionSchema = new Schema({
  version: Number,
  lastUpdated: Date
});

export const dbVersionAPI = connectionAPI.model("dbVersion", dbVersionSchema);
export const dbVersion = connectionDefault.model("dbVersion", dbVersionSchema);
