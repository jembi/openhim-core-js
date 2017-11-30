'use strict'

const {Readable} = require('stream')
const crypto = require('crypto')

const RANDOM_BUFFER = crypto.randomBytes(2 * 1024 * 1024)

class BodyStream extends Readable {
  constructor (length) {
    super({encoding: 'hex'})
    this.remainingLength = length / 2
  }

  _read (size) {
    const length = Math.min(size, this.remainingLength)
    const lastChunk = length === this.remainingLength
    this.remainingLength -= length

    let remaining = length
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, RANDOM_BUFFER.length)
      remaining -= chunkSize
      this.push(RANDOM_BUFFER.slice(0, chunkSize))
    }

    if (lastChunk) {
      this.push(null)
    }
  }
}

module.exports = exports = BodyStream
