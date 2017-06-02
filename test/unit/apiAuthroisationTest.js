import should from "should";
import sinon from "sinon";
import authorisation from "../../lib/api/authorisation";
import { Channel } from "../../lib/model/channels";
import { User } from "../../lib/model/users";

describe("API authorisation test", function() {

  let user = new User({
    firstname: 'Bill',
    surname: 'Murray',
    email: 'bfm@crazy.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: [ 'HISP' , 'group2' ]});

  let user2 = new User({
    firstname: 'Random',
    surname: 'User',
    email: 'someguy@meh.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: [ 'nothing', 'here' ]});

  let user3 = new User({
    firstname: 'Random',
    surname: 'User',
    email: 'someguy@meh.net',
    passwordAlgorithm: 'sha512',
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e',
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0',
    groups: [ 'admin' ]});

  before(function(done) {
    let channel1 = new Channel({
      name: "TestChannel1 - api authorisation",
      urlPattern: "test/sample",
      allow: [ "PoC", "Test1", "Test2" ],
      routes: [{
            name: "test route",
            host: "localhost",
            port: 9876,
            primary: true
          }
          ],
      txViewAcl: [ "group1", "group2" ],
      txRerunAcl: [ "group2" ]});

    let channel2 = new Channel({
      name: "TestChannel2 - api authorisation",
      urlPattern: "test/sample",
      allow: [ "PoC", "Test1", "Test2" ],
      routes: [{
            name: "test route",
            host: "localhost",
            port: 9876,
            primary: true
          }
          ],
      txViewAcl: [ "group2", "group3" ],
      txRerunAcl: [ "group1", "group3" ]});

    let channel3 = new Channel({
      name: "TestChannel3 - api authorisation",
      urlPattern: "test/sample",
      allow: [ "PoC", "Test1", "Test2" ],
      routes: [{
            name: "test route",
            host: "localhost",
            port: 9876,
            primary: true
          }
          ],
      txViewAcl: [ "group4" ],
      txRerunAcl: [ "group4" ]});

    return channel1.save(() =>
      channel2.save(() =>
        channel3.save(() => done())
      )
    );
  });

  after(done =>
    Channel.remove({}, () => done())
  );

  describe(".inGroup", function() {

    it("should return true when a user is in a particular group", function() {
      let result = authorisation.inGroup('group2', user);
      return result.should.be.true;
    });

    return it("should return falsse when a user is in NOT a particular group", function() {
      let result = authorisation.inGroup('somethingelse', user);
      return result.should.be.false;
    });
  });

  describe(".getUserViewableChannels", function() {

    it("should return channels that a user can view", function(done) {
      let promise = authorisation.getUserViewableChannels(user);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(2);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });

    it("should return an empty array when there are no channel that a user can view", function(done) {
      let promise = authorisation.getUserViewableChannels(user2);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(0);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });

    return it("should return all channels for viewing if a user is in the admin group", function(done) {
      let promise = authorisation.getUserViewableChannels(user3);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(3);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });
  });
      
  return describe(".getUserRerunableChannels", function() {

    it("should return channels that a user can rerun", function(done) {
      let promise = authorisation.getUserRerunableChannels(user);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(1);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });

    it("should return an empty array when there are no channel that a user can rerun", function(done) {
      let promise = authorisation.getUserRerunableChannels(user2);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(0);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });

    return it("should return all channels for rerunning if a user is in the admin group", function(done) {
      let promise = authorisation.getUserRerunableChannels(user3);
      return promise.then(function(channels) {
        try {
          channels.should.have.length(3);
        } catch (err) {
          return done(err);
        }
        return done();
      }
      , err => done(err));
    });
  });
});
      
