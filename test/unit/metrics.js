// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from 'should';
import metrics from '../../lib/metrics';
import testUtils from '../../test/testUtils';
import mongoose from 'mongoose';

describe('Metrics unit tests', () =>

  describe('.calculateMetrics()', function() {

    before(done =>
      testUtils.setupMetricsTransactions(() => done())
    );

    it('should return metrics for a particular channel', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, [mongoose.Types.ObjectId('111111111111111111111111')]);
      return p.then(function(metrics) {
        metrics[0].total.should.be.exactly(5);
        metrics[0].failed.should.be.exactly(1);
        metrics[0].successful.should.be.exactly(1);
        metrics[0].completed.should.be.exactly(1);
        metrics[0].processing.should.be.exactly(1);
        metrics[0].completedWErrors.should.be.exactly(1);
        metrics[0].avgResp.should.be.exactly(140);
        metrics[0].minResp.should.be.exactly(100);
        metrics[0].maxResp.should.be.exactly(200);
        return done();}).catch(err => done(err));
    });

    it('should return metrics for all channels', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"));
      return p.then(function(metrics) {
        metrics[0].total.should.be.exactly(10);
        metrics[0].failed.should.be.exactly(1);
        metrics[0].successful.should.be.exactly(1);
        metrics[0].completed.should.be.exactly(6);
        metrics[0].processing.should.be.exactly(1);
        metrics[0].completedWErrors.should.be.exactly(1);
        metrics[0].avgResp.should.be.exactly(150);
        metrics[0].minResp.should.be.exactly(100);
        metrics[0].maxResp.should.be.exactly(200);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by minute', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'minute');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(10);
        metrics[0]._id.minute.should.be.exactly(25);
        metrics[0]._id.hour.should.be.exactly(11);
        metrics[0]._id.day.should.be.exactly(18);
        metrics[0]._id.week.should.be.exactly(28);
        metrics[0]._id.month.should.be.exactly(7);
        metrics[0]._id.year.should.be.exactly(2014);
        metrics[0].total.should.be.exactly(1);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by hour', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'hour');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(9);
        metrics[1]._id.hour.should.be.exactly(11);
        metrics[1]._id.day.should.be.exactly(18);
        metrics[1]._id.week.should.be.exactly(28);
        metrics[1]._id.month.should.be.exactly(7);
        metrics[1]._id.year.should.be.exactly(2014);
        metrics[1].total.should.be.exactly(2);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by day', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'day');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(4);
        metrics[0]._id.day.should.be.exactly(18);
        metrics[0]._id.week.should.be.exactly(28);
        metrics[0]._id.month.should.be.exactly(7);
        metrics[0]._id.year.should.be.exactly(2014);
        metrics[0].total.should.be.exactly(2);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by week', function(done) {
      let p = metrics.calculateMetrics(new Date("2013-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'week');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(2);
        metrics[0]._id.week.should.be.exactly(28);
        metrics[0]._id.month.should.be.exactly(7);
        metrics[0]._id.year.should.be.exactly(2014);
        metrics[0].total.should.be.exactly(10);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by month', function(done) {
      let p = metrics.calculateMetrics(new Date("2013-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'month');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(2);
        metrics[0]._id.month.should.be.exactly(7);
        metrics[0]._id.year.should.be.exactly(2014);
        metrics[0].total.should.be.exactly(10);
        return done();}).catch(err => done(err));
    });

    it('should return metrics in time series by year', function(done) {
      let p = metrics.calculateMetrics(new Date("2013-07-15T00:00:00.000Z"), new Date("2015-07-19T00:00:00.000Z"), null, null, 'year');
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(2);
        metrics[0]._id.year.should.be.exactly(2015);
        metrics[0].total.should.be.exactly(1);
        return done();}).catch(err => done(err));
    });

    it('should return metrics grouped by channels', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, null, true);
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(2);
        metrics[0]._id.channelID.toString().should.be.exactly('222222222222222222222222');
        metrics[0].total.should.be.exactly(5);
        metrics[1]._id.channelID.toString().should.be.exactly('111111111111111111111111');
        metrics[1].total.should.be.exactly(5);
        return done();}).catch(err => done(err));
    });

    it('should return metrics grouped by channels and time series', function(done) {
      let p = metrics.calculateMetrics(new Date("2014-07-15T00:00:00.000Z"), new Date("2014-07-19T00:00:00.000Z"), null, null, 'day', true);
      return p.then(function(metrics) {
        metrics.length.should.be.exactly(8);
        let m1 = metrics.find(m =>
          (m._id.channelID.toString() === '111111111111111111111111') &&
          (m._id.day === 18) &&
          (m._id.week === 28) &&
          (m._id.month === 7) &&
          (m._id.year === 2014)
        );
        should.exist(m1);
        m1.total.should.be.exactly(1);

        let m2 = metrics.find(function(m) {
          return m._id.channelID.toString() === '222222222222222222222222';
          m._id.day === 18;
          m._id.week === 28;
          m._id.month === 7;
          return m._id.year === 2014;
        });
        should.exist(m2);
        m2.total.should.be.exactly(1);
        return done();}).catch(err => done(err));
    });

    return it('should return an error if date not supplied', function(done) {
      let p = metrics.calculateMetrics();
      return p.then(metrics => done(new Error('An error should be thrown'))).catch(function(err) {
        err.should.be.ok();
        return done();
      });
    });
  })
);
