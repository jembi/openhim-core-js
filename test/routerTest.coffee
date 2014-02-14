should = require "should"
sinon = require "sinon"

router = require "../lib/router"

describe "HTTP Router", ->

	describe "Channel", ->
		describe ".toString()", ->
			it "should return a string representation of the channel object", ->
				routes = [
		 				 	host: "localhost"
		 				 	port: "8080"
		 				 ]
				channel = new router.Channel "Test Channel", "test/sample/.+", routes
				channelStr = channel.toString()

				channelStr.should.be.exactly "<Channel: Test Channel>"


	describe ".route", ->
		it "should route an incomming request to the endpoints specific by the channel config"

		it "should return the response from the primary channel"

		it "should be able to multicast to multiple endpoints"

		it "should throw an error if there are multiple primary routes"

	describe ".setChannels(channels) and .getChannels()", ->
		it "should save the channels config to the db and be able to fetch them again", (done) ->
			channels =  [
					 		name: "Test Channel 1"
					 		urlPattern: "test/sample/.+"
					 		routes: [
					 					host: "localhost"
					 					port: "8080"
					 				]
					 	,
					 		name: "Test Channel 2"
					 		urlPattern: "test/sample2/.+"
					 		routes: [
					 					host: "localhost"
					 					port: "8081"
					 				]
					 	]
			console.log "Length: " + channels.length
			router.setChannels channels, ->
				router.getChannels (err, returnedChannels) ->
					returnedChannels.should.have.length 2

					# Clean-up
					router.removeChannel "Test Channel 1", ->
						router.removeChannel "Test Channel 2", ->
							done()



	describe ".getChannel(channelName)", ->
		it "should return the channel with the specified name", (done) ->
			channel =
		 		name: "Unique Test Channel"
		 		urlPattern: "test/sample/.+"
		 		routes: [
		 					host: "localhost"
		 					port: "8080"
		 				]
			router.addChannel channel, ->
				router.getChannel "Unique Test Channel", (err, returnedChannel) ->
					returnedChannel.should.be.ok
					returnedChannel.should.have.property("name", "Unique Test Channel")

					# Clean-up
					router.removeChannel "Unique Test Channel", ->
						done()

		it "should return null if the channel does not exist", (done) ->
			router.getChannel "A Channel that doesn't exist", (err, returnedChannel) ->
				(returnedChannel == null).should.be.true
				done()

	describe ".addChannel(channel)", ->
		it "should add a new channel to the list of channels", (done) ->
			channel =
				name: "Added Channel"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			router.addChannel channel, ->
				router.getChannel "Added Channel", (err, returnedChannel) ->
					returnedChannel.should.be.ok
					returnedChannel.should.have.property "name", "Added Channel"

					# Clean-up
					router.removeChannel channel.name, ->
						done()

		it "should not allow additional channels with the same name to be added", (done) ->
			channel =
				name: "Added Channel"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			router.addChannel channel, ->
				router.addChannel channel, (err) ->
					err.should.be.ok

					# Clean-up
					router.removeChannel channel.name, ->
						done()

	describe ".updateChannel(channel)", ->
		it "should update the supplied channel, keying on the channel name", (done) ->
			channel =
				name: "Channel to update"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			router.addChannel channel, ->
				channel.urlPattern = "test/sample2/.+"
				channel.routes[0].port = 8081
				router.updateChannel channel, ->
					router.getChannel "Channel to update", (err, returnedChannel) ->
						returnedChannel.should.be.ok
						returnedChannel.should.have.property "name", "Channel to update"
						returnedChannel.routes[0].should.have.property "host", "localhost"
						returnedChannel.routes[0].should.have.property "port", 8081

						# Clean-up
						router.removeChannel channel.name, ->
							done()

	describe ".removeChannel(channelName)", ->
		it "should remove the supplied channel, keying on the channel name", (done) ->
			channel =
				name: "Channel to remove"
				urlPattern: "test/sample/.+"
				routes: [
							host: "localhost"
							port: "8080"
						]
			router.addChannel channel, ->
				router.removeChannel channel.name, (err) ->
					router.getChannel "Channel to remove", (err, returnedChannel) ->
						(returnedChannel == null).should.be.true
						done()

