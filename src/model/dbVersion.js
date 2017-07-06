import { Schema } from "mongoose";
import { connectionDefault } from "../config";

const dbVersionSchema = new Schema({
  version: Number,
  lastUpdated: Date
});

export const dbVersion = connectionDefault.model("dbVersion", dbVersionSchema);
