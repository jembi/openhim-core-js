/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import sinon from 'sinon'
import nodemailer from 'nodemailer'
import * as contact from '../../src/contact'
import { config } from '../../src/config'

config.email = config.get('email')
config.smsGateway = config.get('smsGateway')

describe('Contact Users', () => {
  describe('config', () => {
    it('default config should contain email config fields', () => {
      config.email.fromAddress.should.exist
      config.email.nodemailer.should.exist
      config.email.nodemailer.service.should.exist
      config.email.nodemailer.auth.should.exist
      config.email.nodemailer.auth.user.should.exist
      config.email.nodemailer.auth.pass.should.exist
    })

    it('default config should contain smsGateway config fields', () => {
      config.smsGateway.should.exist
      config.smsGateway.provider.should.exist
      config.smsGateway.config.should.exist
      config.smsGateway.config.user.should.exist
      config.smsGateway.config.pass.should.exist
      config.smsGateway.config.apiID.should.exist
    })
  })

  describe('sendEmail', () => {
    let sandbox = null

    beforeEach(() => {
      sandbox = sinon.sandbox.create()
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should propagate errors from nodemailer', (done) => {
      // Stub nodemailer and the transport
      const transportStub = {sendMail: sandbox.stub().yields(new Error('Nodemailer error'))}
      sandbox.stub(nodemailer, 'createTransport').returns(transportStub)

      // Execute the test method
      contact.sendEmail('test@example.com', 'Test', 'Hello world', '<h1>Hello world</h1>', (err) => {
        should.exist(err)
        should.equal(err.message, 'Nodemailer error')
        return done()
      })
    })

    it('should send mail with the correct fields', (done) => {
      const expectedFields = {
        from: 'address@example.com',
        to: 'user@example.com',
        subject: 'Test',
        text: 'Hello world',
        html: '<h1>Hello world</h1>'
      }

      // Stub the sendMail function
      const sendMailStub = sandbox.stub()
      sendMailStub.yields(new Error('Incorrect fields'))
      sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null)

      // Stub nodemailer and the transport
      const transportStub = {sendMail: sendMailStub}
      sandbox.stub(nodemailer, 'createTransport').returns(transportStub)

      // Execute the test method
      contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, (err) => {
        should.not.exist(err)
        return done()
      })
    })

    it('should send mail with the correct fields with old config', (done) => {
      // Temporarily switch config
      const emailConfig = config.email
      config.email = null
      config.nodemailer = emailConfig.nodemailer

      const expectedFields = {
        from: 'user@gmail.com',
        to: 'user@example.com',
        subject: 'Test',
        text: 'Hello world',
        html: '<h1>Hello world</h1>'
      }

      // Stub the sendMail function
      const sendMailStub = sandbox.stub()
      sendMailStub.yields(new Error('Incorrect fields'))
      sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null)

      // Stub nodemailer and the transport
      const transportStub = {sendMail: sendMailStub}
      sandbox.stub(nodemailer, 'createTransport').returns(transportStub)

      // Execute the test method
      contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, (err) => {
        should.not.exist(err)
        // Restore config
        config.nodemailer = null
        config.email = emailConfig
        return done()
      })
    })

    it('should return an error when no config is found', (done) => {
      // Temporarily remove email config
      const emailConfig = config.email
      config.email = null

      // Execute the test method
      contact.sendEmail('test@example.com', 'Test', 'Hello world', '<h1>Hello world</h1>', (err) => {
        should.exist(err)
        should.equal(err.message, 'No email config found')
        // Restore config
        config.email = emailConfig
        return done()
      })
    })
  })
})
