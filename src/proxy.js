const http = require("http");
const { URL } = require("url");
const { writeHarFile, createHar, createEntry } = require("./har");
const log = require("winston");
const {
  getHarRequestFromNodeRequest,
  getHarResponseFromHarRequest,
  writeNodeResponseFromHarResponse,
} = require("./node-conversion");
const { createCommandAction } = require("./command-utils");
const { runServer } = require("./server");

async function proxy({
  listenHost,
  listenPort,
  connectHost,
  connectPort,
  record,
}) {
  const recordedEntries = [];
  const server = http.createServer(handleRequest);
  const connections = [];
  server.on("connection", (connection) => {
    log.debug({
      message: "Connection opened",
      address: connection.localAddress,
      remoteAddress: connection.remoteAddress,
    });
    connections.push(connection);
    connection.on("close", () => {
      log.debug({
        message: "Connection closed",
        address: connection.localAddress,
        remoteAddress: connection.remoteAddress,
      });
      connections.splice(connections.indexOf(connection), 1);
    });
  });

  const agent = new http.Agent({ keepAlive: true });

  await runServer({
    server,
    port: listenPort,
    hostname: listenHost,
  });

  if (record) {
    log.info({
      message: "Writing HAR file...",
      filename: record,
    });
    await writeHarFile(
      record,
      createHar({
        entries: recordedEntries,
      })
    );
  }

  async function handleRequest(req, res) {
    const incomingHarRequest = await getHarRequestFromNodeRequest(req);
    log.debug("Incoming Request", { incomingHarRequest });

    const url = new URL(incomingHarRequest.url);
    url.hostname = connectHost;
    url.port = connectPort;
    const outgoingHarRequest = {
      ...incomingHarRequest,
      url: url.href,
    };

    log.debug("Outgoing Request", { outgoingHarRequest });

    const outgoingHarResponse = await getHarResponseFromHarRequest(
      outgoingHarRequest,
      { agent }
    );
    log.debug("Incoming Response", { outgoingHarResponse });
    log.debug("Outgoing Response", { outgoingHarResponse });
    await writeNodeResponseFromHarResponse(outgoingHarResponse, res);
    recordedEntries.push(
      createEntry({
        request: incomingHarRequest,
        response: outgoingHarResponse,
      })
    );
  }
}

function defineCommand(program) {
  return program
    .command("proxy")
    .requiredOption("--listen-port <port>")
    .option("--listen-host <host>")
    .requiredOption("--connect-host <host>")
    .requiredOption("--connect-port <port>")
    .requiredOption("--record <har_file>")
    .action(createCommandAction(proxy));
}

module.exports = {
  proxy,
  defineCommand,
};
