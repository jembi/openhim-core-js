'use strict'

import logger from 'winston'

import * as Channels from '../model/channels'
import * as utils from '../utils'
import {AutoRetryModelAPI} from '../model/autoRetry'
import {TaskModelAPI} from '../model/tasks'
import {TransactionModelAPI} from '../model/transactions'
import { UserModelAPI } from '../model'
import { RoleModelAPI } from '../model/role'

const {ChannelModelAPI} = Channels

/**
 * Retrieves the list of active tasks
 */
export async function getTasks(ctx) {
  try {
    // Check users permissions
    const authorisedSuper = await utils.checkUserPermission(ctx, 'getTasks', 'transaction-rerun-all')

    const filtersObject = ctx.request.query

    // get limit and page values
    const {filterLimit} = filtersObject
    const {filterPage} = filtersObject

    // determine skip amount
    const filterSkip = filterPage * filterLimit

    // get filters object
    const filters = JSON.parse(filtersObject.filters)

    // Get the specific tasks that user has access to
    if (!authorisedSuper) {
      const usersWithSameRoles = await UserModelAPI.find({groups: {$in: ctx.authenticated.groups}}, {email: 1}).exec()
      filters.user = {$in: usersWithSameRoles.map(user => user.email)}
    }

    // parse date to get it into the correct format for querying
    if (filters.created) {
      filters.created = JSON.parse(filters.created)
    }

    // exclude transactions object from tasks list
    const projectionFiltersObject = {transactions: 0}

    // execute the query
    ctx.body = await TaskModelAPI.find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit, 10))
      .sort({created: -1})
    ctx.status = 200
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch all tasks via the API: ${err}`,
      'error'
    )
  }
}

/**
 * Creates a new Task
 */
export async function addTask(ctx) {
  // Get the values to use
  const transactions = ctx.request.body
  try {
    const taskObject = {}
    const transactionsArr = []
    taskObject.remainingTransactions = transactions.tids.length
    taskObject.user = ctx.authenticated.email

    if (transactions.batchSize != null) {
      if (transactions.batchSize <= 0) {
        return utils.logAndSetResponse(
          ctx,
          400,
          'Invalid batch size specified',
          'info'
        )
      }
      taskObject.batchSize = transactions.batchSize
    }

    if (transactions.paused) {
      taskObject.status = 'Paused'
    }

    const authorisedSuper = await utils.checkUserPermission(ctx, 'addTask', 'transaction-rerun-all')

    const channelsToRerun = await TransactionModelAPI.distinct('channelID', {_id: {$in: transactions.tids}}).exec()

    if (!authorisedSuper) {
      const userRoles = await RoleModelAPI.find({name: {$in: ctx.authenticated.groups}}, {permissions: {'transaction-rerun-specified': 1}}).exec()
      const rerunChannelsAllowed = userRoles.reduce((prev, curr) => prev.concat(curr.permissions['transaction-rerun-specified']), [])

      if (!rerunChannelsAllowed.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          'User is not authorised to create rerun tasks for any channel',
          'info'
        )
        return
      }

      const restrictedChannels = channelsToRerun.filter(channel => !rerunChannelsAllowed.includes(channel))

      if (restrictedChannels.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          `User is not authorised to create rerun tasks for channels ${restrictedChannels.join(', ')}`,
          'info'
        )
        return
      }
    }

    const disabledChannels = await ChannelModelAPI.find({_id: {$in: channelsToRerun}, status: {$in: ['disabled','deleted']}}).exec()

    if (disabledChannels.length) {
      const msg = `Cannot rerun transactions for disabled or deleted channels - ${disabledChannels.map(chan => chan.name).join(', ')}`

      return utils.logAndSetResponse(ctx, 400, msg, 'info')
    }

    for (const tid of Array.from(transactions.tids)) {
      transactionsArr.push({tid})
    }
    taskObject.transactions = transactionsArr
    taskObject.totalTransactions = transactionsArr.length

    /*
      Update the transactions' auto retry attempt number and the autoRetry flag to false
      This is to ensure that any transaction to be rerun is auto retried as per the channel's configuration (autoRetryNumber),
      if there is a failure.
    */
    await TransactionModelAPI.updateMany(
      {_id: {$in: transactions.tids}},
      {autoRetry: false, autoRetryAttempt: 0}
    )

    const task = await new TaskModelAPI(taskObject).save()

    // All ok! So set the result
    utils.logAndSetResponse(
      ctx,
      201,
      `User ${ctx.authenticated.email} created task with id ${task.id}`,
      'info'
    )

    // Clear the transactions out of the auto retry queue, in case they're in there
    return AutoRetryModelAPI.deleteMany({
      transactionID: {$in: transactions.tids}
    })
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not add Task via the API: ${err}`,
      'error'
    )
  }
}

/**
 * Retrieves the details for a specific Task
 */
function buildFilteredTransactionsArray(filters, transactions) {
  // set tempTransactions array to return
  const tempTransactions = []

  let i = 0
  while (i < transactions.length) {
    // set filter variable to captured failed filters
    let filtersFailed = false

    if (filters.tstatus) {
      // if tstatus doesnt equal filter then set filter failed to true
      if (filters.tstatus !== transactions[i].tstatus) {
        filtersFailed = true
      }
    }

    if (filters.rerunStatus) {
      // if rerunStatus doesnt equal filter then set filter failed to true
      if (filters.rerunStatus !== transactions[i].rerunStatus) {
        filtersFailed = true
      }
    }

    if (filters.hasErrors) {
      // if hasErrors filter 'yes' but no hasErrors exist then set filter failed to true
      if (filters.hasErrors === 'yes' && !transactions[i].hasErrors) {
        filtersFailed = true
        // if hasErrors filter 'no' but hasErrors does exist then set filter failed to true
      } else if (filters.hasErrors === 'no' && transactions[i].hasErrors) {
        filtersFailed = true
      }
    }

    // add transaction if all filters passed successfully
    if (filtersFailed === false) {
      tempTransactions.push(transactions[i])
    }

    // increment counter
    i++
  }

  return tempTransactions
}

export async function getTask(ctx, taskId) {
  // Get the values to use
  taskId = unescape(taskId)

  try {
    const authorisedSuper = await utils.checkUserPermission(ctx, 'addTask', 'transaction-rerun-all')

    const result = await TaskModelAPI.findById(taskId).lean().exec()

    if (result === null) {
      // task not found! So inform the user
      return utils.logAndSetResponse(
        ctx,
        404,
        `We could not find a Task with this ID: ${taskId}.`,
        'info'
      )
    }

    if (!authorisedSuper) {
      const userRoles = await RoleModelAPI.find({name: {$in: ctx.authenticated.groups}}, {permissions: {'transaction-rerun-specified': 1}}).exec()
      const rerunChannelsAllowed = userRoles.reduce((prev, curr) => prev.concat(curr.permissions['transaction-rerun-specified']), [])

      if (!rerunChannelsAllowed.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          'User is not authorised to get rerun tasks for any channel',
          'info'
        )
        return
      }

      const channelsToRerun = await TransactionModelAPI.distinct('channelID', {_id: {$in: result.transactions.map(tx => tx.tid)}}).exec()
      const restrictedChannels = channelsToRerun.filter(channel => !rerunChannelsAllowed.includes(channel))

      if (restrictedChannels.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          `User is not authorised to get task with channels ${restrictedChannels.join(', ')}`,
          'info'
        )
        return
      }
    }

    const filtersObject = ctx.request.query

    // get limit and page values
    const {filterLimit} = filtersObject
    const {filterPage} = filtersObject

    // determine skip amount
    const filterSkip = filterPage * filterLimit

    // get filters object
    const filters = JSON.parse(filtersObject.filters)

    let tempTransactions = result.transactions

    // are filters present
    if (Object.keys(filters).length > 0) {
      tempTransactions = buildFilteredTransactionsArray(
        filters,
        result.transactions
      )
    }

    // get new transactions filters length
    const totalFilteredTransactions = tempTransactions.length

    // assign new transactions filters length to result property
    result.totalFilteredTransactions = totalFilteredTransactions

    // work out where to slice from and till where
    const sliceFrom = filterSkip
    const sliceTo = filterSkip + parseInt(filterLimit, 10)

    // slice the transactions array to return only the correct amount of records at the correct index
    result.transactions = tempTransactions.slice(sliceFrom, sliceTo)

    ctx.body = result
    // All ok! So set the result
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch Task by ID ${taskId} via the API: ${err}`,
      'error'
    )
  }
}

/**
 * Updates the details for a specific Task
 */
export async function updateTask(ctx, taskId) {
  // Get the values to use
  taskId = unescape(taskId)
  const taskData = ctx.request.body

  // Ignore _id if it exists, user cannot change the internal id
  if (taskData._id != null) {
    delete taskData._id
  }

  try {
    const authorisedSuper = await utils.checkUserPermission(ctx, 'updateTask', 'transaction-rerun-all')

    const result = await TaskModelAPI.findById(taskId).lean().exec()

    if (result === null) {
      // task not found! So inform the user
      return utils.logAndSetResponse(
        ctx,
        404,
        `We could not find a Task with this ID: ${taskId}.`,
        'info'
      )
    }

    if (!authorisedSuper) {
      const userRoles = await RoleModelAPI.find({name: {$in: ctx.authenticated.groups}}, {permissions: {'transaction-rerun-specified': 1}}).exec()
      const rerunChannelsAllowed = userRoles.reduce((prev, curr) => prev.concat(curr.permissions['transaction-rerun-specified']), [])

      if (!rerunChannelsAllowed.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          'User is not authorised to update rerun tasks for any channel',
          'info'
        )
        return
      }

      const channelsToRerun = await TransactionModelAPI.distinct('channelID', {_id: {$in: result.transactions.map(tx => tx.tid)}}).exec()
      const restrictedChannels = channelsToRerun.filter(channel => !rerunChannelsAllowed.includes(channel))

      if (restrictedChannels.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          `User is not authorised to update task with channels ${restrictedChannels.join(', ')}`,
          'info'
        )
        return
      }
    }

    await TaskModelAPI.findOneAndUpdate({_id: taskId}, taskData).exec()

    // All ok! So set the result
    ctx.body = 'The Task was successfully updated'
    logger.info(
      `User ${ctx.authenticated.email} updated task with id ${taskId}`
    )
    ctx.status = 200
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not update Task by ID {taskId} via the API: ${err}`,
      'error'
    )
  }
}

/**
 * Deletes a specific Tasks details
 */
export async function removeTask(ctx, taskId) {
  // Get the values to use
  taskId = unescape(taskId)

  try {
    const authorisedSuper = await utils.checkUserPermission(ctx, 'removeTask', 'transaction-rerun-all')

    const result = await TaskModelAPI.findById(taskId).lean().exec()

    if (result === null) {
      // task not found! So inform the user
      return utils.logAndSetResponse(
        ctx,
        404,
        `We could not find a Task with this ID: ${taskId}.`,
        'info'
      )
    }

    if (!authorisedSuper) {
      const userRoles = await RoleModelAPI.find({name: {$in: ctx.authenticated.groups}}, {permissions: {'transaction-rerun-specified': 1}}).exec()
      const rerunChannelsAllowed = userRoles.reduce((prev, curr) => prev.concat(curr.permissions['transaction-rerun-specified']), [])

      if (!rerunChannelsAllowed.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          'User is not authorised to remove rerun tasks for any channel',
          'info'
        )
        return
      }

      const channelsToRerun = await TransactionModelAPI.distinct('channelID', {_id: {$in: result.transactions.map(tx => tx.tid)}}).exec()
      const restrictedChannels = channelsToRerun.filter(channel => !rerunChannelsAllowed.includes(channel))

      if (restrictedChannels.length) {
        utils.logAndSetResponse(
          ctx,
          403,
          `User is not authorised to remove task for channels ${restrictedChannels.join(', ')}`,
          'info'
        )
        return
      }
    }

    // Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
    await TaskModelAPI.deleteOne({_id: taskId}).exec()

    // All ok! So set the result
    ctx.body = 'The Task was successfully deleted'
    logger.info(
      `User ${ctx.authenticated.email} removed task with id ${taskId}`
    )
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not remove Task by ID {taskId} via the API: ${err}`,
      'error'
    )
  }
}
