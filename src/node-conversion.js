const log = require("winston");
const { URL } = require("url");
const zlib = require("zlib");
const { Readable } = require("stream");
const http = require("http");
const https = require("https");
const { fromRawHeaders, toObject } = require("./name-value");
const { createErrorHarResponse } = require("./har");

function getHeaders(req) {
  const headers = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    headers.push({ name: req.rawHeaders[i], value: req.rawHeaders[i + 1] });
  }
  return headers;
}

function convertURLSearchParamsToNameValues(urlSearchParams) {
  return [...urlSearchParams.entries()].map(([key, value]) => ({
    name: key,
    value,
  }));
}

function readStreamText(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("data", (chunk) => {
      data += chunk.toString();
    });
    stream.once("error", (err) => {
      reject(err);
    });
    stream.on("end", () => {
      resolve(data);
    });
  });
}

async function nodeRequestToHarRequest(nodeRequest) {
  const text = await readStreamText(nodeRequest);
  const mimeType = nodeRequest.headers["content-type"];
  const host = nodeRequest.headers["host"];
  const url = new URL(nodeRequest.url, `http://${host}`);
  const headers = getHeaders(nodeRequest);
  const queryString = convertURLSearchParamsToNameValues(url.searchParams);
  const postData = (text || undefined) && {
    mimeType,
    text,
  };
  return {
    method: nodeRequest.method,
    url: url.toString(),
    httpVersion: nodeRequest.httpVersion,
    headers,
    queryString,
    postData,
    headersSize: -1,
    bodySize: -1,
  };
}

async function readStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => {
      chunks.push(chunk);
    });
    stream.on("error", (err) => {
      reject(err);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

async function harResponseToNodeResponse(harResponse, nodeResponse) {
  if (harResponse.status === 0) {
    // The response is invalid. Kill the connection.
    return nodeResponse.socket.destroy();
  }
  nodeResponse.statusCode = harResponse.status;
  nodeResponse.statusMessage = harResponse.statusMessage;
  for (const { name, value } of harResponse.headers) {
    nodeResponse.setHeader(name, value);
  }
  if (harResponse.content.mimeType) {
    nodeResponse.setHeader("Content-Type", harResponse.content.mimeType);
  }
  let body = Readable.from(
    Buffer.from(
      harResponse.content.text,
      harResponse.content.encoding || "utf8"
    )
  );
  if (nodeResponse.getHeader("Content-Encoding") === "gzip") {
    body = body.pipe(zlib.createGzip());
  }
  if (nodeResponse.getHeader("Content-Length")) {
    nodeResponse.removeHeader("Content-Length");
    nodeResponse.removeHeader("Transfer-Encoding");
    const buffer = await readStream(body);
    nodeResponse.setHeader("Content-Length", buffer.length);
    return nodeResponse.end(buffer);
  } else if (nodeResponse.getHeader("Transfer-Encoding") === "chunked") {
    return body.pipe(nodeResponse);
  } else {
    nodeResponse.removeHeader("Transfer-Encoding");
    return body.pipe(nodeResponse);
  }
}

function doRequest({ protocol, body, ...options }) {
  return new Promise((resolve, reject) => {
    log.debug({
      message: "Http Request",
      options,
    });
    const request = protocol.request(options, resolve);
    request.on("error", (error) => {
      reject(error);
    });
    if (body) {
      body.pipe(request);
    } else {
      request.end();
    }
  });
}

async function getHarResponseFromHttpResponse(response) {
  const bodyBuffer = await readStream(response);
  const status = response.statusCode;
  const statusText = response.statusMessage;
  const headers = fromRawHeaders(response.rawHeaders);
  const mimeType = response.headers["Content-Type"];
  const bodyText = bodyBuffer.toString("utf-8");
  const content = {
    size: bodyBuffer.length,
    mimeType,
    text: bodyText,
  };
  return {
    status,
    statusText,
    httpVersion: "HTTP/1.1",
    cookies: {},
    headers,
    content,
    redirectURL: "",
    headersSize: -1,
    bodySize: bodyBuffer.length,
  };
}

async function tryCatch(tryFn, catchFn) {
  try {
    return await tryFn();
  } catch (error) {
    return await catchFn(error);
  }
}

async function getHarResponseFromHarRequest(request, { agent }) {
  const method = request.method;
  const url = new URL(request.url);
  const protocol = {
    "http:": http,
    "https:": https,
  }[url.protocol];
  const path = `${url.pathname}${url.search}`;
  const hostname = url.hostname;
  const port = url.port;
  const headers = toObject(request.headers);
  const body =
    request.postData && request.postData.text
      ? Readable.from(
          request.postData.text,
          request.postData.encoding || "utf-8"
        )
      : undefined;

  return await tryCatch(
    async () => {
      const response = await doRequest({
        protocol,
        agent,
        hostname,
        port,
        method,
        path,
        headers,
        body,
      });

      return await getHarResponseFromHttpResponse(response);
    },
    async (error) => {
      return createErrorHarResponse(error.toString());
    }
  );
}

const getHarRequestFromNodeRequest = nodeRequestToHarRequest;
const writeNodeResponseFromHarResponse = harResponseToNodeResponse;

module.exports = {
  nodeRequestToHarRequest,
  harResponseToNodeResponse,
  getHarRequestFromNodeRequest,
  writeNodeResponseFromHarResponse,
  getHarResponseFromHarRequest,
};
