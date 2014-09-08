Agenda = require "agenda"
contact = require "../contact"
agenda = new Agenda(db:
	address: "localhost:27017/agenda-example"
)

contact =
agenda.define "send email report",
	priority: "high"
	concurrency: 10
, (job, done) ->
	data = job.attrs.data
	contact.contactUser
		to: data.to
		from: "example@example.com"
		subject: "Email Report"
		body: "..."
	, done
	return

agenda.schedule "in 20 minutes", "send email report",
	to: "admin@example.com"

agenda.start()