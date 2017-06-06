import mongoose from "mongoose";
import server from "../server";

const { connectionDefault } = server;
const { Schema } = mongoose;

const AutoRetrySchema = new Schema({
	transactionID: {
		type: Schema.Types.ObjectId, required: true
	},
	channelID: {
		type: Schema.Types.ObjectId, required: true
	},
	requestTimestamp: {
		type: Date, required: true
	}
});

export const AutoRetry = connectionDefault.model("AutoRetry", AutoRetrySchema);
