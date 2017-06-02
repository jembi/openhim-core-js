import mongoose from 'mongoose';
import server from '../server';
let { connectionDefault } = server;
let { Schema } = mongoose;

let dbVersion = new Schema({
  version:      Number,
  lastUpdated:  Date
});

let dbVersion$1 = connectionDefault.model('dbVersion', dbVersion);
export { dbVersion$1 as dbVersion };