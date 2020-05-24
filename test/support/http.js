const { doRequest } = require("../../src/node-conversion");
const http = require("http");
const { readStreamText } = require("../../src/node-conversion");

const DEFAULT_HOSTNAME = "localhost";
const DEFAULT_PORT = 80;
const DEFAULT_HANDLER = (req, res) => res.end();

async function startServer(
  { hostname = DEFAULT_HOSTNAME, port = DEFAULT_PORT },
  handler = DEFAULT_HANDLER
) {
  const server = http.createServer((req, res) => {
    res.sendDate = false;
    return handler(req, res);
  });
  await new Promise((resolve) => server.listen(port, hostname, 1, resolve));
  return server;
}

async function request(options) {
  const response = await doRequest({
    protocol: http,
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_PORT,
    url: "/",
    ...options,
  });
  response.body = await readStreamText(response);
  return response;
}

module.exports = {
  DEFAULT_HOSTNAME,
  DEFAULT_PORT,
  DEFAULT_HANDLER,
  startServer,
  request,
};
