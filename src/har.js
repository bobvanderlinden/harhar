const { promises: fs } = require("fs");

async function readHarFile(filePath) {
  const text =
    filePath === "-"
      ? await fs.readFile(0, { encoding: "utf8" })
      : await fs.readFile(filePath, { encoding: "utf8" });
  return JSON.parse(text);
}

async function writeHarFile(filePath, harContent) {
  const text = JSON.stringify(harContent, null, 2);
  if (filePath === "-") {
    process.stdout.write(text);
    process.stdout.write("\n");
  } else {
    await fs.writeFile(filePath, text);
  }
}

function createHar({ entries }) {
  return {
    log: {
      version: "1.2",
      creator: {
        name: "harhar",
        version: "",
      },
      entries,
    },
  };
}

function createTimings({ send = -1, wait = -1, receive = -1, ...rest }) {
  return {
    send,
    wait,
    receive,
    ...rest,
  };
}

function createEntry({
  startedDateTime = new Date().toISOString(),
  time = -1,
  cache = {},
  timings = createTimings({}),
  request,
  response,
}) {
  return {
    startedDateTime,
    time,
    cache,
    timings,
    request,
    response,
  };
}

function createRequest({ url, ...request }) {
  return {
    method: 'GET',
    url,
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: [],
    queryString: [],
    headersSize: -1,
    bodySize: -1,
    ...request,
  };
}

function createResponse(response) {
  return {
    status: 200,
    statusText: "OK",
    httpVersion: "HTTP/1.1",
    cookies: [],
    headers: [],
    content: {
      size: 0,
      mimeType: "x-unknown",
    },
    redirectURL: "",
    headersSize: -1,
    bodySize: -1,
    ...response,
  };
}

function createErrorHarResponse(errorMessage) {
  return {
    status: 0,
    statusText: "",
    httpVersion: "",
    headers: [],
    cookies: [],
    content: {
      size: 0,
      mimeType: "x-unknown",
    },
    redirectURL: "",
    headersSize: -1,
    bodySize: -1,
    _transferSize: 0,
    _error: errorMessage,
  };
}

module.exports = {
  readHarFile,
  writeHarFile,
  createHar,
  createEntry,
  createErrorHarResponse,
  createRequest,
  createResponse,
};
