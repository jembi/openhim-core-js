should = require "should"
request = require "supertest"
server = require "../../lib/server"
User = require('../../lib/model/users').User
crypto = require "crypto"

describe "API Integration Tests", ->

  describe 'General API tests', ->

    user = new User
      firstname: 'Bill'
      surname: 'Murray'
      email: 'bfm@crazy.net'
      passwordAlgorithm: 'sha512'
      passwordHash: '669c981d4edccb5ed61f4d77f9fcc4bf594443e2740feb1a23f133bdaf80aae41804d10aa2ce254cfb6aca7c497d1a717f2dd9a794134217219d8755a84b6b4e'
      passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
      groups: [ 'HISP', 'admin' ]
      # password is 'password'

    before (done) ->
      server.start apiPort: 8080, ->
        user.save ->
          done()

    after (done) ->
      User.remove {}, ->
        server.stop ->
          done();

    it 'should set the cross-origin resource sharing headers', (done) ->
      request("https://localhost:8080")
        .get("/authenticate/bfm@crazy.net")
        .expect(200)
        .expect('Access-Control-Allow-Origin', '*')
        .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE')
        .end (err, res) ->
          if err
            done err
          else
            done()

    it 'should disallow access if no API authentication details are provided', (done) ->
      request("https://localhost:8080")
        .get("/channels")
        .expect(401)
        .end (err, res) ->
          if err
            done err
          else
            done()

    it 'should disallow access if token does not match', (done) ->

      request("https://localhost:8080")
        .get("/authenticate/bfm@crazy.net")
        .expect(200)
        .end (err, res) ->
          if err
            done err
          else
            passwordsalt = res.body.salt

            # create passwordhash
            passwordhash = crypto.createHash('sha512');
            passwordhash.update(passwordsalt);
            passwordhash.update('password');

            # create tokenhash
            authTS = new Date().toISOString()
            requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
            tokenhash = crypto.createHash('sha512');
            tokenhash.update(passwordhash.digest('hex'));
            tokenhash.update(requestsalt);
            tokenhash.update(authTS);

            request("https://localhost:8080")
              .get("/channels")
              .set("auth-username", "bfm@crazy.net")
              .set("auth-ts", authTS)
              .set("auth-salt", requestsalt + 'incorrect')
              .set("auth-token", tokenhash.digest('hex'))
              .expect(401)
              .end (err, res) ->
                if err
                  done err
                else
                  done()

    it 'should allow access if correct API authentication details are provided', (done) ->

      request("https://localhost:8080")
        .get("/authenticate/bfm@crazy.net")
        .expect(200)
        .end (err, res) ->
          if err
            done err
          else
            passwordsalt = res.body.salt

            # create passwordhash
            passwordhash = crypto.createHash('sha512');
            passwordhash.update(passwordsalt);
            passwordhash.update('password');

            # create tokenhash
            authTS = new Date().toISOString()
            requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
            tokenhash = crypto.createHash('sha512');
            hashStr = passwordhash.digest('hex')
            tokenhash.update(hashStr);
            tokenhash.update(requestsalt);
            tokenhash.update(authTS);

            request("https://localhost:8080")
              .get("/channels")
              .set("auth-username", "bfm@crazy.net")
              .set("auth-ts", authTS)
              .set("auth-salt", requestsalt)
              .set("auth-token", tokenhash.digest('hex'))
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  done()

    it 'should disallow access if the request is too old', (done) ->

      request("https://localhost:8080")
        .get("/authenticate/bfm@crazy.net")
        .expect(200)
        .end (err, res) ->
          if err
            done err
          else
            passwordsalt = res.body.salt

            # create passwordhash
            passwordhash = crypto.createHash('sha512');
            passwordhash.update(passwordsalt);
            passwordhash.update('password');

            # create tokenhash
            authTS = new Date()
            authTS.setSeconds(authTS.getSeconds() - 13);
            authTS = authTS.toISOString()
            requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
            tokenhash = crypto.createHash('sha512');
            tokenhash.update(passwordhash.digest('hex'));
            tokenhash.update(requestsalt);
            tokenhash.update(authTS);

            request("https://localhost:8080")
              .get("/channels")
              .set("auth-username", "bfm@crazy.net")
              .set("auth-ts", authTS)
              .set("auth-salt", requestsalt)
              .set("auth-token", tokenhash.digest('hex'))
              .expect(401)
              .end (err, res) ->
                if err
                  done err
                else
                  done()
