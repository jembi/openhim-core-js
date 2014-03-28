mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema


MONGO_DB_URL= 'mongodb://localhost:27017/test'

mongoose.connect MONGO_DB_URL  
ApplicationSchema = new Schema
    "applicationId": {type: String, required: true}
    "domain": {type: String, required: true}
    "name": {type: String, required: true}
    "roles": [ {type: String, required: true }]
    "passwordHash": {type: String, required: false}
    "cert": {type: String, required: false}
    
#compile the Application Schema into a Model
Application = mongoose.model 'Applications', ApplicationSchema

###
# Gets all channel currently registered.
# 
# Accepts (done) where done is a callback that will be called with (err, items)
# err will contain an error object if an error occurs otherwise items will
# contain an array fo Channel objects.
###

# save() updates existing application-object or inserts new ones as needed
# testApplicationDoc ={applicationID: "Ishmael_OpenMRS",domain: "him.jembi.org",name: "OpenMRS Ishmael instance",roles: [ "OpenMRS_PoC", "PoC" ],passwordHash: "",cert: ""}


exports.addApplication = (insertValues, done) ->
	newApplication  = new Application insertValues
	newApplication.save (err, saveResult) ->     
			if err
				console.log "Unable to save record: #{err}"
				return done err
			else
				console.log "Application Collection Save #{saveResult}"  
				return done null, saveResult    

#find all applications
exports.findAll = (done) ->
	Application.find (err, applications) ->     
			if err
				console.log "Unable to find applications: #{err}"
				return done err
			else
				console.log "Found Application #{applications}"  
				return done null, applications  

#find an application by applicationID
exports.findApplicationById = (id, done) ->
	Application.findOne {"applicationId":id},(err, application) ->     
			if err
				console.log "Unable to find application: #{err}"
				return done err
			else
				console.log "Found Application #{application}"  
				return done null, application   

#lookup the application by domain
exports.findApplicationByDomain = (domain, done) ->
	Application.findOne {"domain":domain},(err, application) ->     
			if err
				console.log "Unable to find application: #{err}"
				return done err
			else
				console.log "Found Application #{application}"  
				return done null, application  

#update the specified application
exports.updateApplication = (id, updates, done) ->	
	Application.findOneAndUpdate {"applicationId":id}, updates,(err) ->     
			if err
				console.log "Unable to Update Application: #{err}"
				return done err
			else
				console.log "Updated Application"  
				return done null   

#remove the specified application 
exports.removeApplication = (id, done) ->	
	Application.remove {"applicationId":id},(err) ->     
			if err
				console.log "Unable to Remove Application: #{err}"
				return done err
			else
				console.log "Removed Application "  
				return done null   