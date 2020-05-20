const { matchIgnoreNames, sortByName } = require("./name-value");
const http = require("http");
const { URL } = require("url");
const hash = require("object-hash");
const { readHarFile, writeHarFile, createHar, createEntry } = require("./har");
const log = require("winston");
const {
  nodeRequestToHarRequest,
  harResponseToNodeResponse,
} = require("./node-conversion");
const {
  collect,
  createCommandAction,
  createAlertController,
} = require("./command-utils");
const { runServer } = require("./server");

function hashHarRequest(
  request,
  {
    ignoreHostname,
    ignorePort,
    matchHeaders,
    ignoreHeaders,
    ignoreHeaderCasing,
    ignoreHeaderOrder,
    matchQueryStringParams,
    ignoreQueryStringParams,
    ignoreQueryStringParamOrder,
    ignorePostData,
  }
) {
  const url = new URL(request.url);
  let headers = matchIgnoreNames(request.headers, {
    matches: matchHeaders,
    ignores: ignoreHeaders,
    caseSensitive: false,
  });

  if (ignoreHeaderCasing) {
    headers = headers.map((header) => ({
      name: header.name.toLowerCase(),
      value: header.value,
    }));
  }
  if (ignoreHeaderOrder) {
    headers = sortByName(headers);
  }

  let queryStringParams = matchIgnoreNames(request.queryString, {
    matches: matchQueryStringParams,
    ignores: ignoreQueryStringParams,
  });

  if (ignoreQueryStringParamOrder) {
    queryStringParams = sortByName(queryStringParams);
  }

  const postData =
    (!ignorePostData &&
      request.postData &&
      ((request.postData.params && request.postData.params.length) ||
        request.postData.text) && {
        mimeType: request.postData.mimeType,
        params:
          (request.postData.params &&
            request.postData.params.length &&
            request.postData.params.map(({ name, value }) => ({
              name,
              value,
            }))) ||
          undefined,
        text: request.postData.text,
      }) ||
    undefined;

  const hashInput = {
    method: request.method,
    hostname: !ignoreHostname && url.hostname,
    port: !ignorePort && url.port,
    pathname: url.pathname,
    headers: headers,
    queryString: queryStringParams,
    postData,
  };
  const requestHash = hash(hashInput);
  const requestId = request.headers
    .filter(({ name }) => name === "X-Request-ID")
    .map(({ value }) => value)[0];

  log.debug({
    message: "Hashing request",
    input: hashInput,
    hash: requestHash,
    requestId,
  });
  return requestHash;
}

async function serverreplay({ port, input, record, ...options }) {
  const alertController = createAlertController();
  const harInput = await readHarFile(input);
  const hashedEntries = Object.fromEntries(
    harInput.log.entries.map((entry) => [
      hashHarRequest(entry.request, options),
      entry,
    ])
  );
  const recordedEntries = [];

  const server = http.createServer(async (req, res) => {
    const harRequest = await nodeRequestToHarRequest(req);
    log.debug({
      message: "Received request",
      request: harRequest,
    });
    const hash = hashHarRequest(harRequest, options);
    const harEntry = hashedEntries[hash];
    if (!harEntry) {
      log.warn({
        message: "Could not replay request",
        request: harRequest,
      });
      res.statusCode = 599;
      return res.end();
    } else {
      const harResponse = harEntry.response;
      log.info({
        message: "Replay response",
        request: harRequest,
        response: harResponse,
      });

      recordedEntries.push(
        createEntry({
          request: harRequest,
          response: harResponse,
        })
      );

      await harResponseToNodeResponse(harResponse, res);
    }
  });

  await runServer({
    server,
    port,
    signal: alertController.signal,
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
}

function defineCommand(program) {
  return program
    .command("serverreplay")
    .description(
      `Run a HTTP server that replays responses from a HAR file by looking up the incoming request by specific properties. The incoming requests and outgoing responses can be recorded to a new HAR file.`
    )
    .requiredOption("--port <port>")
    .requiredOption("--input <har_file>")
    .option("--ignore-hostname", "", false)
    .option("--ignore-port", "", false)
    .option("--match-headers <header>", "", collect, [])
    .option("--ignore-headers <header>", "", collect, [])
    .option("--ignore-header-casing", "", false)
    .option("--ignore-header-order", "", false)
    .option("--match-query-string-params <param>", "", collect, [])
    .option("--ignore-query-string-params <param>", "", collect, [])
    .option("--ignore-query-string-param-order", "", false)
    .option("--ignore-post-data", "", false)
    .option("--record <har_file>", "")
    .action(createCommandAction(serverreplay));
}

module.exports = {
  serverreplay,
  defineCommand,
};
