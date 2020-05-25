const {
  matchIgnoreNames,
  sortByName,
  getValueByName,
} = require("./name-value");
const http = require("http");
const { URL } = require("url");
const hash = require("object-hash");
const { readHarFile, writeHarFile, createHar, createEntry } = require("./har");
const log = require("winston");
const {
  getHarRequestFromNodeRequest,
  writeNodeResponseFromHarResponse,
} = require("./node-conversion");
const {
  collect,
  createCommandAction,
  createAbortController,
} = require("./command-utils");
const { runServer } = require("./server");

function hashHarRequest(
  request,
  {
    matchRequestId,
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

  const requestId = getValueByName(request.headers, "X-Request-Id", {
    caseSensitive: false,
  });

  const hashInput =
    matchRequestId && requestId
      ? requestId
      : {
          method: request.method,
          hostname: !ignoreHostname && url.hostname,
          port: !ignorePort && url.port,
          pathname: url.pathname,
          headers: headers,
          queryString: queryStringParams,
          postData,
        };
  const requestHash = hash(hashInput);
  log.debug({
    message: "Hashing request",
    input: hashInput,
    hash: requestHash,
    requestId,
  });
  return requestHash;
}

async function run({ port, harInput, abortController, ...options }) {
  const hashedEntries = Object.fromEntries(
    harInput.log.entries.map((entry) => [
      hashHarRequest(entry.request, options),
      entry,
    ])
  );
  const recordedEntries = [];

  const server = http.createServer(async (req, res) => {
    const harRequest = await getHarRequestFromNodeRequest(req);
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

      await writeNodeResponseFromHarResponse(harResponse, res);
    }
  });

  await runServer({
    server,
    port,
    signal: abortController.signal,
  });

  return createHar({
    entries: recordedEntries,
  });
}

async function runCommand({ port, input, record, ...options }) {
  const abortController = createAbortController();
  const harInput = await readHarFile(input);

  const result = await run({ port, harInput, abortController, ...options });

  if (record) {
    log.info({
      message: "Writing HAR file...",
      filename: record,
    });
    await writeHarFile(record, result);
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
    .option("--match-request-id", "", false)
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
    .action(createCommandAction(runCommand));
}

module.exports = {
  runCommand,
  run,
  defineCommand,
};
