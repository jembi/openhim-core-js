const http = require('http')

process.title = 'clientLoadTest'

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end()
})

server.listen(11111, '127.0.0.1', () => {
  console.log('server listening on port 11111')
})
