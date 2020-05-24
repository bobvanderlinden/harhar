const { readHarFile, writeHarFile, createHar, createEntry } = require("./har");
const log = require("winston");
const { getHarResponseFromHarRequest } = require("./node-conversion");
const { transformRequest } = require("./transform");
const { createCommandAction } = require("./command-utils");
const http = require("http");

async function run({ inputHar, ...options }) {
  const agent = new http.Agent({ keepAlive: true });
  const recordedEntries = [];
  for (const entry of inputHar.log.entries) {
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
  return createHar({ entries: recordedEntries });
}

async function runCommand({ input, record, ...options }) {
  const inputHar = await readHarFile(input);
  const result = await run({ inputHar, ...options });
  await writeHarFile(record, result);
}

function defineCommand(program) {
  return program
    .command("clientreplay")
    .description(
      `Replays the requests of a HAR file. The responses that were sent back can optionally be recorded to a new HAR file.`
    )
    .requiredOption("--input <har_file>")
    .requiredOption("--record <har_file>")
    .option("--replace-hostname <new_hostname>")
    .option("--replace-port <new_port>")
    .action(createCommandAction(runCommand));
}

module.exports = {
  run,
  runCommand,
  defineCommand,
};
