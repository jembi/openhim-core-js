'use strict'

const {Readable} = require('stream')
const crypto = require('crypto')

class BodyStream extends Readable {
  constructor (length, encoding = 'hex') {
    super({encoding})
    this.remainingLength = length
  }

  _read (size) {
    const length = Math.min(size, this.remainingLength)
    const lastChunk = length === this.remainingLength
    this.remainingLength -= length
    crypto.randomBytes(length, (err, buf) => {
      if (err) {
        return process.nextTick(() => {
          this.emit('error', err)
        })
      }
      this.push(buf)
      if (lastChunk) {
        this.push(null)
      }
    })
  }
}

module.exports = exports = BodyStream
