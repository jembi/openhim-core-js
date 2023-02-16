import {config, connectionAPI} from '../config'
import {Schema} from 'mongoose'

/**
 * Session Store
 *
 * To be able to store the session in a Mongo collection instead of just saving it in memory
 *
 */

const SessionSchema = new Schema({
  _id: String,
  data: Object,
  updatedAt: {
    default: new Date(),
    type: Date
  }
})

class MongooseStore {
  constructor() {
    this.session = connectionAPI.model('Session', SessionSchema)
  }

  /**
   *  Override of the destroy, get and set functions used in session
   *
   */

  async destroy(id) {
    const {session} = this
    return session.deleteOne({_id: id})
  }

  async get(id) {
    const {session} = this
    const {data} = (await session.findById(id)) || {}
    return data
  }

  async set(id, data, maxAge, {changed, rolling}) {
    if (changed || rolling) {
      const {session} = this
      const record = {_id: id, data, updatedAt: new Date()}
      await session.findByIdAndUpdate(id, record, {upsert: true, safe: true})
    }
    return data
  }

  // This function is required by 'passport-openidconnect'
  verify = async function (req, handle, next) {
    var state = {handle}
    var ctx = {
      maxAge: config.api.maxAge,
      issued: ''
    }

    return next(null, ctx, state)
  }

  static create() {
    return new MongooseStore()
  }
}

export default MongooseStore
