/* eslint-env mocha */

import { VisualizerModel } from '../../src/model/visualizer'

xdescribe('Visualizer Model Tests', () => {
  const visObj = {
    name: 'TestVisualizer',
    components: [{
      eventType: 'primary',
      eventName: 'OpenHIM Mediator FHIR Proxy Route',
      display: 'FHIR Server'
    },
    {
      eventType: 'primary',
      eventName: 'echo',
      display: 'Echo'
    }
    ],
    color: {
      inactive: '#c8cacf',
      active: '#10e057',
      error: '#a84b5c',
      text: '#4a4254'
    },
    size: {
      responsive: true,
      width: 1000,
      height: 400,
      paddin: 20
    },
    time: {
      updatePeriod: 200,
      maxSpeed: 5,
      maxTimeout: 5000,
      minDisplayPeriod: 500
    },
    channels: [{
      eventType: 'channel',
      eventName: 'FHIR Proxy',
      display: 'FHIR Proxy'
    },
    {
      eventType: 'channel',
      eventName: 'Echo',
      display: 'Echo'
    }
    ],
    mediators: [{
      mediator: 'urn:mediator:fhir-proxy',
      name: 'OpenHIM Mediator FHIR Proxy',
      display: 'OpenHIM Mediator FHIR Proxy'
    },
    {
      mediator: 'urn:mediator:shell-script',
      name: 'OpenHIM Shell Script Mediator',
      display: 'OpenHIM Shell Script Mediator'
    }
    ]
  }

  return it('should save and retrieve from the visualizer collection', (done) => {
    const vis = new VisualizerModel(visObj)
    return vis.save((err) => {
      if (err) { return done(err) }
      return VisualizerModel.findOne({name: 'TestVisualizer'}, (err, foundVis) => {
        if (err) { return done(err) }
        foundVis.should.have.property('name').which.is.exactly('TestVisualizer')
        foundVis.should.have.property('components').which.has.property('length').which.is.exactly(2)
        foundVis.should.have.property('mediators').which.has.property('length').which.is.exactly(2)
        foundVis.should.have.property('channels').which.has.property('length').which.is.exactly(2)
        foundVis.color.inactive.should.be.exactly('#c8cacf')
        foundVis.size.responsive.should.be.true()
        foundVis.time.updatePeriod.should.be.exactly(200)
        return done()
      })
    })
  })
})
