/* eslint-env mocha */

import should from 'should'
import sinon from 'sinon'
import xpath from 'xpath'
import { DOMParser as Dom } from 'xmldom'
import * as rewriteUrls from '../../src/middleware/rewriteUrls'
import * as utils from '../../src/utils'

describe('Rewrite URLs middleware', () => {
  const sandbox = sinon.sandbox.create()
  afterEach(() => {
    sandbox.restore()
  })
  describe('.invertPathTransform', () =>

    it('should invert various path transforms', () => {
      rewriteUrls.invertPathTransform('s/one/two/').should.be.exactly('s/two/one/')
      rewriteUrls.invertPathTransform('s/one/two').should.be.exactly('s/two/one/')
      rewriteUrls.invertPathTransform('s/one/two/g').should.be.exactly('s/two/one/g')
      rewriteUrls.invertPathTransform('s/one/two/gi').should.be.exactly('s/two/one/gi')
    })
  )

  describe('.fetchRewriteConfig', () => {
    const currentChannel = {
      rewriteUrls: true,
      rewriteUrlsConfig: [{
        fromHost: 'from.org',
        toHost: 'to.org',
        fromPort: 80,
        toPort: 5001,
        pathTransform: 's/some/transform/'
      }
      ],
      routes: [{
        primary: true,
        host: 'route0.org',
        port: 5555,
        pathTransform: 's/from/to/g'
      }
      ]
    }

    const channel1 = {
      routes: [{
        primary: true,
        host: 'route1.org',
        port: 5556,
        pathTransform: 's/from1/to1/g'
      },
      {
        host: 'route2.org',
        port: 5557
      }
      ]
    }

    const channel2 = {
      routes: [{
        host: 'route3.org',
        port: 5558,
        pathTransform: 's/from3/to3/g'
      },
      {
        primary: true,
        host: 'route4.org',
        port: 5559
      }
      ]
    }

    it('should fetch the rewrite config for the current channel and INCLUDE virtual defaults', (done) => {
      currentChannel.addAutoRewriteRules = true
      const stub = sandbox.stub(utils, 'getAllChannelsInPriorityOrder')
      stub.callsArgWith(0, null, [currentChannel, channel1, channel2])

      rewriteUrls.fetchRewriteConfig(currentChannel, 'tls', (err, rewriteConfig) => {
        if (err) { return done(err) }
        rewriteConfig.should.have.length(4)
        rewriteConfig[0].fromHost.should.be.exactly('from.org')
        rewriteConfig[0].toHost.should.be.exactly('to.org')
        rewriteConfig[0].pathTransform.should.be.exactly('s/some/transform/')
        rewriteConfig[1].fromHost.should.be.exactly('route0.org')
        rewriteConfig[1].toHost.should.be.exactly('localhost')
        rewriteConfig[1].pathTransform.should.be.exactly('s/to/from/g')
        rewriteConfig[2].fromHost.should.be.exactly('route1.org')
        rewriteConfig[2].toHost.should.be.exactly('localhost')
        rewriteConfig[2].pathTransform.should.be.exactly('s/to1/from1/g')
        rewriteConfig[3].fromHost.should.be.exactly('route4.org')
        rewriteConfig[3].toHost.should.be.exactly('localhost')
        should.not.exist(rewriteConfig[3].pathTransform)
        return done()
      })
    })

    it('should fetch the rewrite config for the current channel and EXCLUDE virtual defaults', (done) => {
      currentChannel.addAutoRewriteRules = false
      const stub = sandbox.stub(utils, 'getAllChannelsInPriorityOrder')
      stub.callsArgWith(0, null, [currentChannel, channel1, channel2])
      rewriteUrls.fetchRewriteConfig(currentChannel, 'tls', (err, rewriteConfig) => {
        if (err) { return done(err) }
        rewriteConfig.should.have.length(1)
        rewriteConfig[0].fromHost.should.be.exactly('from.org')
        rewriteConfig[0].toHost.should.be.exactly('to.org')
        rewriteConfig[0].pathTransform.should.be.exactly('s/some/transform/')
        return done()
      })
    })
  })

  describe('.rewriteUrls', () => {
    const channel = {
      rewriteUrls: true,
      rewriteUrlsConfig: [{
        fromHost: 'from.org',
        toHost: 'to.org',
        fromPort: 80,
        toPort: 5001,
        pathTransform: 's/some/transform/'
      }],
      routes: [{
        primary: true,
        host: 'route0.org',
        port: 5555
      }
      ]
    }

    const jsonResponse = {
      prop1: 'prop1',
      prop2: 'prop2',
      href: 'http://from.org/test1',
      obj: {
        prop3: 'prop3',
        href: 'http://fromWithTransform.org:8080/this'
      },
      obj2: {
        href: '/test1/from/xyz'
      },
      obj3: {
        fullUrl: 'http://fromWithTransform.org:8080/this'
      }
    }

    it('should rewrite absolute hrefs in JSON', (done) => {
      const rewiredChannel = Object.assign({}, channel, {
        rewriteUrlsConfig: [
          {
            fromHost: 'fromWithTransform.org',
            toHost: 'toWithTransform.org',
            pathTransform: 's/this/that/',
            fromPort: 8080,
            toPort: 5000
          },
          {
            fromHost: 'from.org',
            toHost: 'to.org',
            fromPort: 80,
            toPort: 5001
          }
        ]
      })

      rewriteUrls.rewriteUrls((JSON.stringify(jsonResponse)), rewiredChannel, 'tls', (err, newResponse) => {
        if (err) { return done(err) }
        newResponse = JSON.parse(newResponse)
        newResponse.obj.href.should.be.exactly('https://toWithTransform.org:5000/that')
        newResponse.href.should.be.exactly('http://to.org:5001/test1')
        newResponse.obj3.fullUrl.should.be.exactly('https://toWithTransform.org:5000/that')
        return done()
      })
    })

    it('should rewrite relative hrefs in JSON', (done) => {
      const rewiredChannel = Object.assign({}, channel, {
        rewriteUrlsConfig: [
          {
            fromHost: 'route0.org',
            toHost: 'route0To.org',
            pathTransform: 's/from/to',
            fromPort: 5555,
            toPort: 5001
          }
        ]
      })

      rewriteUrls.rewriteUrls((JSON.stringify(jsonResponse)), rewiredChannel, 'tls', (err, newResponse) => {
        if (err) { return done(err) }
        newResponse = JSON.parse(newResponse)
        newResponse.obj2.href.should.be.exactly('/test1/to/xyz')
        return done()
      })
    })

    const xmlResponse = `\
<?xml version="1" encoding="utf-8"?>
<someTags>
  <tag1 href="http://from.org/test1"/>
  <tag2>
    <child href="http://fromWithTransform.org:8080/this"></child>
  </tag2>
  <img src="http://from.org/image" />
</someTags>\
`

    it('should rewrite hrefs in XML', (done) => {
      const rewiredChannel = Object.assign({}, channel, {
        rewriteUrlsConfig: [{
          fromHost: 'from.org',
          toHost: 'to.org',
          fromPort: 80,
          toPort: 5001
        },
        {
          fromHost: 'fromWithTransform.org',
          toHost: 'toWithTransform.org',
          pathTransform: 's/this/that/',
          fromPort: 8080,
          toPort: 5000
        }]
      })

      rewriteUrls.rewriteUrls(xmlResponse, rewiredChannel, 'tls', (err, newResponse) => {
        if (err) { return done(err) }
        const doc = new Dom().parseFromString(newResponse)
        const href1 = xpath.select('string(//someTags/tag1/@href)', doc)
        const href2 = xpath.select('string(//someTags/tag2/child/@href)', doc)
        const src = xpath.select('string(//someTags/img/@src)', doc)
        href1.should.be.exactly('http://to.org:5001/test1')
        href2.should.be.exactly('https://toWithTransform.org:5000/that')
        src.should.be.exactly('http://to.org:5001/image')
        return done()
      })
    })
  })
})
