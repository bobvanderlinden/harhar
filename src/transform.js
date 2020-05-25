const { readHarFile, writeHarFile } = require("./har");
const { URL } = require("url");
const {
  matchIgnoreNames,
  sortByName,
  mapNames,
  getValueByName,
  setValueByName,
  parseHeaders,
  stringifyHeaders,
} = require("./name-value");
const { collect, createCommandAction } = require("./command-utils");
const contentType = require("content-type");

function normalizeHeaderName(headerName) {
  return headerName.toLowerCase().split(/\W/).join("-");
}

function decodeText({ text, encoding }) {
  switch (encoding) {
    case "base64":
      return Buffer.from(text, "base64").toString("binary");
    case undefined:
      return text;
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

function encodeText({ text, encoding }) {
  switch (encoding) {
    case "base64":
      return Buffer.from(text, "binary").toString("base64");
    case undefined:
      return text;
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

function parseMultipartSegment(part) {
  const [headersString, body] = part.split("\r\n\r\n", 2);
  const headers = parseHeaders(headersString);
  return {
    headers,
    body: body,
  };
}

function stringifyMultipartSegment(part) {
  return `${stringifyHeaders(part.headers)}\r\n\r\n${part.body}`;
}

function transformMultipartFormDataSegment(segment, options) {
  const headers = matchIgnoreNames(segment.headers, {
    matches: options.matchMultipartHeaders,
    ignores: options.ignoreMultipartHeaders,
    caseSensitive: false,
  });
  return {
    ...segment,
    headers,
  };
}

function transformMultipartFormDataPostData(
  postData,
  originalMimeType,
  options
) {
  const originalBoundary = originalMimeType.parameters.boundary;
  if (!originalBoundary) {
    return postData;
  }
  const newMimeType = {
    ...originalMimeType,
    parameters: {
      ...originalMimeType.parameters,
      boundary: options.replaceMultipartBoundary,
    },
  };
  const newMimeTypeString = contentType.format(newMimeType);

  const parts = decodeText(postData).split(`--${originalBoundary}`);
  if (options.sortMultipart) {
    const contentParts = parts
      .slice(1, parts.length - 1)
      .map(parseMultipartSegment)
      .map((segment) => transformMultipartFormDataSegment(segment, options))
      .map(stringifyMultipartSegment);
    contentParts.sort();
    parts.splice(1, contentParts.length, ...contentParts);
  }
  const text =
    postData.text &&
    encodeText({
      text: parts.join(`--${options.replaceMultipartBoundary}`),
      encoding: postData.encoding,
    });

  return {
    ...postData,
    mimeType: newMimeTypeString,
    text,
  };
}

function transformPostData(postData, options) {
  const originalMimeTypeString = postData.mimeType;
  const originalMimeType = contentType.parse(originalMimeTypeString);
  if (originalMimeType.type === "multipart/form-data") {
    return transformMultipartFormDataPostData(
      postData,
      originalMimeType,
      options
    );
  } else {
    return postData;
  }
}

function transformRequest(request, options) {
  if (!request) {
    return request;
  }
  const url = new URL(request.url);
  if (options.replaceHostname !== undefined) {
    url.hostname = options.replaceHostname;
  }
  if (options.replacePort !== undefined) {
    url.port = options.replacePort;
  }
  if (options.replaceProtocol !== undefined) {
    url.protocol = options.replaceProtocol;
  }
  if (options.removeQueryStringFromUrl) {
    for (const key of url.searchParams.keys()) {
      url.searchParams.delete(key);
    }
    url.search = "";
  }

  let headers = request.headers;

  const postData =
    (request.postData && transformPostData(request.postData, options)) ||
    undefined;

  // Make sure Content-Type is in equal to postData.mimeType.
  if (
    postData &&
    getValueByName(headers, "Content-Type", { caseSensitive: false }) !==
      postData.mimeType
  ) {
    headers = setValueByName(headers, "Content-Type", postData.mimeType, {
      caseSensitive: false,
    });
  }

  headers = matchIgnoreNames(headers, {
    matches: options.matchHeaders,
    ignores: options.ignoreHeaders,
    caseSensitive: false,
  });

  if (options.sortHeaders) {
    headers = sortByName(headers);
  }

  if (options.normalizeHeaderNames) {
    headers = mapNames(headers, normalizeHeaderName);
  }

  let queryString = matchIgnoreNames(request.queryString, {
    matches: options.matchQueryStringParams,
    ignores: options.ignoreQueryStringParams,
  });

  if (options.sortQueryStringParams) {
    queryString = sortByName(queryString);
  }

  return {
    ...request,
    url: url.toString(),
    headers,
    queryString,
    postData,
    headersSize: options.scrubSizes ? -1 : request.headersSize,
    bodySize: options.scrubSizes ? -1 : request.bodySize,
  };
}

function transformResponse(response, options) {
  if (!response) {
    return response;
  }
  let headers = matchIgnoreNames(response.headers, {
    matches: options.matchHeaders,
    ignores: options.ignoreHeaders,
  });

  return {
    ...response,
    statusText:
      options.replaceStatusText !== undefined
        ? options.replaceStatusText
        : response.statusText,
    headers,
    headersSize: options.scrubSizes ? -1 : response.headersSize,
    bodySize: options.scrubSizes ? -1 : response.bodySize,
    content: response.content && {
      ...response.content,
      compression: options.scrubSizes
        ? undefined
        : response.content.compression,
      size: options.scrubSizes ? -1 : response.content.size,
    },
  };
}

function transformEntry(entry, options) {
  return {
    ...entry,
    startedDateTime: options.scrubTimings ? undefined : entry.startedDateTime,
    time: options.scrubTimings ? 0 : entry.time,
    timings: options.scrubTimings
      ? { send: -1, wait: -1, receive: -1 }
      : entry.timings,
    request: transformRequest(entry.request, options),
    response: transformResponse(entry.response, options),
  };
}

function transformCreator(creator) {
  return creator;
}
function transformBrowser(browser) {
  return browser;
}
function transformPages(pages) {
  return pages;
}
function transformComment(comment) {
  return comment;
}

function transformEntries(entries, options) {
  return entries.map((entry) => transformEntry(entry, options));
}

function transformHar(har, options) {
  return {
    log: {
      ...har.log,
      creator: transformCreator(har.log.creator, options),
      browser: transformBrowser(har.log.browser, options),
      pages: transformPages(har.log.pages, options),
      entries: transformEntries(har.log.entries, options),
      comment: transformComment(har.log.comment, options),
    },
  };
}

async function transform({ input, output, ...options }) {
  const harInput = await readHarFile(input);
  const harOutput = transformHar(harInput, options);
  await writeHarFile(output, harOutput);
}

function defineCommand(program) {
  return program
    .command("transform")
    .description(
      `Transforms a HAR file and outputs the result to a new HAR file.`
    )
    .requiredOption("--input <har_file>")
    .requiredOption("--output <har_file>")
    .option("--ignore-headers <header>", "", collect, [])
    .option("--ignore-query-string-params <param>", "", collect, [])
    .option("--match-headers <header>", "", collect, [])
    .option("--match-query-string-params <param>", "", collect, [])
    .option("--match-multipart-headers <header>", "", collect, [])
    .option("--ignore-multipart-headers <header>", "", collect, [])
    .option("--normalize-header-names")
    .option("--remove-query-string-from-url")
    .option("--replace-hostname <new_hostname>")
    .option("--replace-port <new_port>")
    .option("--replace-protocol <new_protocol>")
    .option("--replace-status-text <status_text>")
    .option("--replace-multipart-boundary <new_boundary>")
    .option("--scrub-timings")
    .option("--scrub-sizes")
    .option("--sort-headers")
    .option("--sort-query-string-params")
    .option("--sort-multipart")
    .action(createCommandAction(transform));
}

module.exports = {
  transform,
  transformHar,
  transformPostData,
  transformRequest,
  defineCommand,
};
