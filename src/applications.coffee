mongo = require 'mongodb'
mongoose = require 'mongoose'
Schema = mongoose.Schema
config = require './config'
config.mongo = config.get('mongo')

mongoose.connect config.mongo.url

ApplicationSchema = new Schema
    "applicationID": {type: String, required: true}
    "domain": {type: String, required: true}
    "name": {type: String, required: true}
    "roles": [ {type: String, required: true }]
    "passwordHash": {type: String, required: false}
    "cert": {type: String, required: false}
    
#compile the Application Schema into a Model
Application = mongoose.model 'Application', ApplicationSchema

# save() updates existing application-object or inserts new ones as needed
# testApplicationDoc ={applicationID: "Ishmael_OpenMRS",domain: "him.jembi.org",name: "OpenMRS Ishmael instance",roles: [ "OpenMRS_PoC", "PoC" ],passwordHash: "",cert: ""}

exports.addApplication = (insertValues, done) ->
	newApplication  = new Application insertValues
	newApplication.save (err, saveResult) ->     
			if err
				return done err
			else
				return done null, saveResult    

#find an application by applicationID
exports.findApplicationById = (id, done) ->
	Application.findOne {"applicationID":id},(err, application) ->     
			if err
				return done err
			else
				return done null, application   

#lookup the application by domain
exports.findApplicationByDomain = (domain, done) ->
	Application.findOne {"domain":domain},(err, application) ->     
			if err
				return done err
			else
				return done null, application

#update the specified application
exports.updateApplication = (id, updates, done) ->	
	Application.findOneAndUpdate {"applicationID":id}, updates,(err) ->     
			if err
				return done err
			else
				return done null   

#remove the specified application 
exports.removeApplication = (id, done) ->	
	Application.remove {"applicationID":id},(err) ->     
			if err
				return done err
			else
				return done null

#get all specified applications 
exports.getApplications = (done) ->	
	Application.find {}, (err, applications) ->     
			if err
				return done err, null
			else
				return done null, applications
