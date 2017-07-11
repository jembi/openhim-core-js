import mongoose from "mongoose";
import { config } from "./";
import * as utils from "../utils";

config.mongo = config.get("mongo");

console.log('======================================================================');
console.log(utils.getExtraMongoConfig());
console.log('======================================================================');
export const connectionDefault = mongoose.createConnection(config.mongo.url, utils.getExtraMongoConfig());
export const connectionATNA = mongoose.createConnection(config.mongo.atnaUrl);
