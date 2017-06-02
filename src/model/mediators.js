let configDef;
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;
import { RouteDef } from './channels';
import { ChannelDef } from './channels';

export let configParamTypes = [ 'string', 'bool', 'number', 'option', 'bigstring', 'map', 'struct', 'password' ];

let configDef$1 = (configDef = {
  "param":        String,
  "displayName":  String,
  "description":  String,
  "type": {         type: String, enum: exports.configParamTypes
},
  "values":       [ {type: String} ],
  "template":     { type: Array },
  "array":        Boolean
});

// The properties prefixed with an '_' are internally used properties and shouldn't be set by the user
export { configDef$1 as configDef };
let MediatorSchema = new Schema({
  "urn": {                    type: String, required: true, unique: true
},
  "version": {                type: String, required: true
},
  "name": {                   type: String, required: true
},
  "description":            String,
  "endpoints":              [RouteDef],
  "defaultChannelConfig":   [ChannelDef],
  "configDefs":             [configDef],
  "config":                 Object,
  "_configModifiedTS":      Date,
  "_uptime":                Number,
  "_lastHeartbeat":         Date
});

// Model for describing a collection of mediators that have registered themselves with core
export let Mediator = connectionDefault.model('Mediator', MediatorSchema);
