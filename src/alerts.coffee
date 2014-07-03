
alertingTask = (done) -> console.log "it's me! I was the turkey all along!"

exports.setupAgenda = (agenda) ->
	agenda.define 'generate transaction alerts', (job, done) -> alertingTask done
	agenda.every '60 seconds', 'generate transaction alerts'
