import mongoose from "mongoose";
import { config } from "./";

config.mongo = config.get("mongo");

export const connectionDefault = mongoose.createConnection(config.mongo.url);
export const connectionATNA = mongoose.createConnection(config.mongo.atnaUrl);
