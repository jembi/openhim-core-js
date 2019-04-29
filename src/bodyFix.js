import { retrievePayload } from './contentChunk'

const addBodiesToTransactions = async (transactions) => {
  if(!transactions ||
    transactions.length < 1
  ) {
    return []
  }

  const transformedTransactions = await transactions.map(trans => {
    // let transformedTrans = transformTransaction(trans)

    if(
        trans &&
        trans.request &&
        trans.request.bodyId
    ) {
        retrievePayload(trans.request.bodyId).then(body => {
          trans.request.body = body
            return
        }).catch(err => {throw new Error(err)})
    }

    if(
        trans &&
        trans.response &&
        trans.response.bodyId
    ) {
        retrievePayload(trans.response.bodyId).then(body => {
          trans.response.body = body
            return
        }).catch(err => {throw new Error(err)})
    }

    return trans
  })

  return transformedTransactions
}
  
// removes the bodyId field transaction
const transformTransaction = (trans) => {
  let transformedTrans = {}

  transformedTrans.request = {}
  transformedTrans.response = {}

  if(trans._id) transformedTrans._id = trans._id
  if(trans.clientID) transformedTrans.clientID = trans.clientID
  if(trans.clientIP) transformedTrans.clientIP = trans.clientIP
  if(trans.parentID) transformedTrans.parentID = trans.parentID
  if(trans.childIDs) transformedTrans.childIDs = trans.childIDs
  if(trans.channelID) transformedTrans.channelID = trans.channelID
  if(trans.routes) transformedTrans.routes = trans.routes
  if(trans.orchestrations) transformedTrans.orchestrations = trans.orchestrations
  if(trans.properties) transformedTrans.properties = trans.properties
  if(trans.canRerun) transformedTrans.canRerun = trans.canRerun
  if(trans.autoRetry) transformedTrans.autoRetry = trans.autoRetry
  if(trans.autoRetryAttempt) transformedTrans.autoRetryAttempt = trans.autoRetryAttempt
  if(trans.wasRerun) transformedTrans.wasRerun = trans.wasRerun
  if(trans.error) transformedTrans.error = trans.error
  if(trans.status) transformedTrans.status = trans.status

  if(trans.request.host) transformedTrans.request.host = trans.request.host
  if(trans.request.port) transformedTrans.request.port = trans.request.port
  if(trans.request.path) {transformedTrans.request.path = trans.request.path}
  if(trans.request.headers) transformedTrans.request.headers = trans.request.headers
  if(trans.request.querystring) transformedTrans.request.querystring = trans.request.querystring
  if(trans.request.method) transformedTrans.request.method = trans.request.method
  if(trans.request.timestamp) transformedTrans.request.timestamp = trans.request.timestamp

  if(trans.response.status) transformedTrans.response.status = trans.response.status
  if(trans.response.headers) transformedTrans.response.headers = trans.response.headers
  if(trans.response.timestamp) transformedTrans.response.timestamp = trans.response.timestamp

  return transformedTrans
}

exports.addBodiesToTransactions = addBodiesToTransactions
exports.transformTransaction = transformTransaction
