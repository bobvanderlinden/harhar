const { readHarFile, writeHarFile, createHar, createEntry } = require("./har");
const log = require("winston");
const { getHarResponseFromHarRequest } = require("./node-conversion");
const { transformRequest } = require("./transform");
const { createCommandAction } = require("./command-utils");
const http = require("http");

async function clientreplay({ input, record, ...options }) {
  const agent = new http.Agent({ keepAlive: true });
  const har = await readHarFile(input);
  const recordedEntries = [];
  for (const entry of har.log.entries) {
    const readHarRequest = entry.request;
    log.debug("Read request", { readHarRequest });
    const outgoingHarRequest = transformRequest(readHarRequest, options);
    log.debug("Requesting", { outgoingHarRequest });
    const harResponse = await getHarResponseFromHarRequest(outgoingHarRequest, {
      agent,
    });
    log.debug("Responded", { harResponse });
    recordedEntries.push(
      createEntry({
        request: outgoingHarRequest,
        response: harResponse,
      })
    );
  }
  await writeHarFile(record, createHar({ entries: recordedEntries }));
}

function defineCommand(program) {
  return program
    .command("clientreplay")
    .requiredOption("--input <har_file>")
    .requiredOption("--record <har_file>")
    .option("--replace-hostname <new_hostname>")
    .option("--replace-port <new_port>")
    .action(createCommandAction(clientreplay));
}

module.exports = {
  clientreplay,
  defineCommand,
};
