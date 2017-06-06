import mongoose from "mongoose";
import server from "../server";

const { connectionDefault } = server;
const { Schema } = mongoose;

const dbVersionSchema = new Schema({
	version: Number,
	lastUpdated: Date
});

const dbVersion = connectionDefault.model("dbVersion", dbVersionSchema);
