import { EmailTemplate } from 'email-templates'
import logger from 'winston'
import moment from 'moment'
import Q from 'q'
import { path as appRoot } from 'app-root-path'
import * as authorisation from './api/authorisation'
import { config } from './config'
import * as contact from './contact'
import * as metrics from './metrics'
import { UserModel } from './model/users'
import * as utils from './utils'

config.reports = config.get('reports')

// Function Sends the reports
function sendReports (job, flag, done) {
  let fetchUsers
  let from
  let to

  const reportMap = {}
  const channelReportMap = {}
  const channelMap = {}

  if (flag === 'dailyReport') {
    from = moment().subtract(1, 'days').startOf('day').toDate()
    to = moment().subtract(1, 'days').endOf('day').toDate()
  } else {
    from = moment().startOf('isoWeek').subtract(1, 'weeks').toDate()
    to = moment().endOf('isoWeek').subtract(1, 'weeks').toDate()
  }

  // Select the right subscribers for the report
  if (flag === 'dailyReport') {
    fetchUsers = fetchDailySubscribers
  }
  if (flag === 'weeklyReport') {
    fetchUsers = fetchWeeklySubscribers
  }

  return fetchUsers((err, users) => {
    if (err) { return done(err) }
    const promises = []
    let userKey = ''
    let userIndex = 0
    const usersArray = []
    for (const user of Array.from(users)) {
      const deferred = Q.defer()
      userKey = user.email
      authorisation.getUserViewableChannels(user)
        .then((channels) => {
          usersArray[userIndex] = user
          usersArray[userIndex].allowedChannels = channels
          for (const channel of Array.from(usersArray[userIndex].allowedChannels)) {
            channelMap[channel._id] = {
              user,
              channel
            }
          }

          userIndex++
          return deferred.resolve()
        })

      return promises.push(deferred.promise)
    }

    // Loop through the enriched user array
    const innerPromises = []
    return (Q.all(promises)).then(() => {
      // Pre-Fetch report data into Channel Map
      for (const key in channelMap) {
        const obj = channelMap[key]
        const innerDeferred = Q.defer();
        ((innerDeferred, key, obj) =>
          fetchChannelReport(obj.channel, obj.user, flag, from, to, (err, item) => {
            if (err) { return done(err) }
            channelReportMap[key] = item
            return innerDeferred.resolve()
          }))(innerDeferred, key, obj)

        innerPromises.push(innerDeferred.promise)
      }

      return (Q.all(innerPromises)).then(() => {
        for (const user of Array.from(usersArray)) {
          userKey = user.email
          for (const channel of Array.from(user.allowedChannels)) {
            if (reportMap[userKey]) {
              // Do nothing since object already exists
            } else {
              // Create the object
              reportMap[userKey] = {
                email: user.email,
                data: []
              }
            }

            // If report has been fetched get it from the map
            if (channelReportMap[channel._id]) {
              const data = channelReportMap[channel._id]
              // add report - always add if the channel is enabled (treating undefined status as enabled), otherwise only if there is data
              if ((data.channel.status == null) || (data.channel.status === 'enabled') || (data.data.length !== 0)) {
                return reportMap[userKey].data.push(data)
              }
            } else {
              return logger.error('should never be here since channels have been pre-fetched')
            }
          }
        }

        // Iterate over reports and send the emails
        for (const key in reportMap) {
          const report = reportMap[key]
          if (flag === 'dailyReport') {
            report.type = 'Daily'
            report.isDaily = true
          } else {
            report.type = 'Weekly'
            report.isDaily = false
          }

          report.instance = config.alerts.himInstance
          report.consoleURL = config.alerts.consoleURL

          report.from = moment(from).format('YYYY-MM-DD')
          report.to = moment(to).format('YYYY-MM-DD')

          try {
            for (let i = 0; i < report.data.length; i++) {
              const data = report.data[i]
              const colorGrey = 'color: grey;'
              let rowColor = 'background-color: #d9ead3'
              if (i % 2) {
                rowColor = 'background-color: #b6d7a8;'
              }

              const totals = calculateTotalsFromGrouping(data)
              for (const key in totals) {
                report.data[i][key] = totals[key]
              }

              report.data[i].totalStyle = (report.data[i].total > 0 ? '' : colorGrey)
              report.data[i].avgRespStyle = (report.data[i].avgResp > 0 ? '' : colorGrey)
              report.data[i].failedStyle = (report.data[i].failed > 0 ? 'color: red;' : colorGrey)
              report.data[i].successfulStyle = (report.data[i].successful > 0 ? '' : colorGrey)
              report.data[i].processingStyle = (report.data[i].processing > 0 ? '' : colorGrey)
              report.data[i].completedStyle = (report.data[i].completed > 0 ? 'color: orange;' : colorGrey)
              report.data[i].completedWErrorsStyle = (report.data[i].completedWErrors > 0 ? 'color: orangered;' : colorGrey)
              report.data[i].rowColor = rowColor
            }

            sendUserEmail(report)
          } catch (err) {
            logger.error(err)
            job.fail(`Failed to send report reason: ${err}`)
          }
        }

        return done()
      })
    })
  })
}

function calculateTotalsFromGrouping (data) {
  const totals = {
    total: 0,
    avgResp: 0,
    failed: 0,
    successful: 0,
    processing: 0,
    completed: 0,
    completedWErrors: 0
  }

  data.data.forEach((val, index) =>
    (() => {
      const result = []
      for (const key in totals) {
        if (key === 'avgResp') {
          result.push(totals[key] += (((data.data[index] != null ? data.data[index][key] : undefined) != null) ? Math.round(data.data[index][key]) / 1000 : 0))
        } else {
          result.push(totals[key] += (((data.data[index] != null ? data.data[index][key] : undefined) != null) ? data.data[index][key] : 0))
        }
      }
      return result
    })()
  )

  return totals
}

function sendUserEmail (report) {
  report.date = new Date().toString()
  return renderTemplate('report', report, reportHtml => contact.contactUser('email', report.email, `${report.type} report for: ${report.instance}`, plainTemplate(report), reportHtml, afterEmail))
}

function fetchChannelReport (channel, user, flag, from, to, callback) {
  let period
  if (flag === 'dailyReport') {
    period = 'day'
  } else {
    period = 'week'
  }

  const item = {}

  logger.info(`fetching ${flag} for #${channel.name} ${user.email} ${channel._id}`)

  return metrics.calculateMetrics(from, to, null, [channel._id], period)
    .then((data) => {
      item.channel = channel
      item.data = data
      return callback(null, item)
    }).catch((err) => {
      logger.error('Error calculating metrics: ', err)
      return callback(err)
    })
}

const fetchDailySubscribers = callback => { UserModel.find({ dailyReport: true }, callback) }

const fetchWeeklySubscribers = callback => { UserModel.find({ weeklyReport: true }, callback) }

function plainTemplate (report) {
  let text = `Generated on: ${new Date().toString()}`
  for (const data of Array.from(report.data)) {
    text += ` \r\n \r\n <---------- Start Channel  ${data.channel.name} ---------------------------> \r\n \r\n \
Channel Name: ${data.channel.name} \r\n \
Channel total: ${((data.data[0] != null ? data.data[0].total : undefined) != null) ? data.data[0].total : 0} transactions  \r\n \
Ave response time: ${((data.data[0] != null ? data.data[0].avgResp : undefined) != null) ? data.data[0].avgResp : 0} \r\n \
Failed:  ${((data.data[0] != null ? data.data[0].failed : undefined) != null) ? data.data[0].failed : 0}  \r\n \
Successful:  ${((data.data[0] != null ? data.data[0].successful : undefined) != null) ? data.data[0].successful : 0}  \r\n \
Processing: ${((data.data[0] != null ? data.data[0].processing : undefined) != null) ? data.data[0].processing : 0}  \r\n \
Completed:  ${((data.data[0] != null ? data.data[0].completed : undefined) != null) ? data.data[0].completed : 0}  \r\n \
Completed with errors: ${((data.data[0] != null ? data.data[0].completedWErrors : undefined) != null) ? data.data[0].completedWErrors : 0} \r\n \r\n \
<---------- End Channel -------------------------------------------------> \r\n \r\n \
\r\n \
\r\n\
`
  }
  return text
}

function renderTemplate (templateName, templateData, callback) {
  const templateDir = `${appRoot}/templates/${templateName}`
  const template = new EmailTemplate(templateDir)
  return template.render(templateData, (err, result) => {
    if (err) {
      logger.error(err)
    }
    return callback(result.html.toString())
  })
}

const afterEmail = callback => logger.info('email sent..')

export function setupAgenda (agenda) {
  agenda.define('send weekly channel metrics', (job, done) => sendReports(job, 'weeklyReport', done))

  agenda.define('send daily channel metrics', (job, done) => sendReports(job, 'dailyReport', done))

  agenda.every(config.reports.weeklyReportAt, 'send weekly channel metrics', null, { timezone: utils.serverTimezone() })
  return agenda.every(config.reports.dailyReportAt, 'send daily channel metrics', null, { timezone: utils.serverTimezone() })
}

if (process.env.NODE_ENV === 'test') {
  exports.sendReports = sendReports
  exports.fetchDailySubscribers = fetchDailySubscribers
  exports.fetchWeeklySubscribers = fetchWeeklySubscribers
  exports.fetchChannelReport = fetchChannelReport
  exports.sendUserEmail = sendUserEmail
  exports.calculateTotalsFromGrouping = calculateTotalsFromGrouping
}
