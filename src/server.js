const log = require("winston");

function runServer({
  server,
  port = 3000,
  hostname = undefined,
  backlog = undefined,
}) {
  return new Promise((resolve, reject) => {
    const connections = [];
    server.on("connection", handleConnection);

    function handleConnection(connection) {
      log.debug({
        message: "Connection opened",
        address: connection.localAddress,
        remoteAddress: connection.remoteAddress,
      });
      connections.push(connection);
      connection.on("close", handleConnectionClose.bind(this, connection));
    }

    function handleConnectionClose(connection) {
      log.debug({
        message: "Connection closed",
        address: connection.localAddress,
        remoteAddress: connection.remoteAddress,
      });
      connections.splice(connections.indexOf(connection), 1);
    }

    async function cleanup() {
      process.removeListener("SIGINT", cleanup);
      process.removeListener("SIGTERM", cleanup);

      log.debug("Closing server");
      server.close();

      server.removeListener("connection", handleConnection);

      log.debug("Closing connections");
      for (const connection of connections) {
        connection.close();
      }
      resolve();
    }

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    server.listen(port, hostname, backlog, (err) => {
      if (err) {
        return reject(err);
      }
    });
  });
}

module.exports = {
  runServer,
};
