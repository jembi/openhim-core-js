import { Schema } from "mongoose";
import { connectionDefault } from "../config";

const dbVersionSchema = new Schema({
	version: Number,
	lastUpdated: Date
});

const dbVersion = connectionDefault.model("dbVersion", dbVersionSchema);
