const log = require("winston");
const { URL } = require("url");
const zlib = require("zlib");
const { Readable } = require("stream");
const http = require("http");
const https = require("https");
const { fromRawHeaders, toObject } = require("./name-value");
const { createErrorHarResponse, createRequest, createResponse } = require("./har");
const { StringDecoder } = require("string_decoder");

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

function readStreamText(stream, encoding = "utf8") {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder(encoding);
    let result = "";
    stream.on("data", (chunk) => {
      result += decoder.write(chunk);
    });
    stream.once("error", (err) => {
      reject(err);
    });
    stream.on("end", () => {
      result += decoder.end();
      resolve(result);
    });
  });
}

async function readStreamBase64(stream) {
  return await readStreamText(stream, "base64");
}

function isBinaryMimeType(mimeType) {
  if (!mimeType) {
    return false;
  }
  if (/^text\//.test(mimeType)) {
    return false;
  }
  if (/^image\//.test(mimeType)) {
    return true;
  }
  if (/^application\/octet-stream/.test(mimeType)) {
    return true;
  }
  if (/^application\/x-www-form-urlencoded/.test(mimeType)) {
    return false;
  }
  if (/^multipart\//.test(mimeType)) {
    return true;
  }
  return false;
}

async function getPostDataFromNodeRequest(nodeRequest) {
  const mimeType = nodeRequest.headers["content-type"];
  const isBinary = isBinaryMimeType(mimeType);
  const encoding = isBinary ? "base64" : undefined;
  const text = isBinary
    ? await readStreamBase64(nodeRequest)
    : await readStreamText(nodeRequest);
  if (text === "") {
    return undefined;
  }
  return {
    mimeType,
    encoding,
    text,
  };
}

async function getHarRequestFromNodeRequest(nodeRequest) {
  const host = nodeRequest.headers["host"];
  const url = new URL(nodeRequest.url, `http://${host}`);
  const headers = getHeaders(nodeRequest);
  const queryString = convertURLSearchParamsToNameValues(url.searchParams);
  const postData = await getPostDataFromNodeRequest(nodeRequest);
  return createRequest({
    method: nodeRequest.method,
    url: url.toString(),
    httpVersion: nodeRequest.httpVersion,
    headers,
    queryString,
    postData,
    headersSize: -1,
    bodySize: -1,
  });
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

async function writeNodeResponseFromHarResponse(harResponse, nodeResponse) {
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
  let body = harResponse.content.text
    ? Readable.from([
        Buffer.from(
          harResponse.content.text,
          harResponse.content.encoding || "utf8"
        ),
      ])
    : Readable.from([]);
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
  const mimeType = response.headers["content-type"];
  const content = isBinaryMimeType(mimeType)
    ? {
        size: bodyBuffer.length,
        mimeType,
        encoding: "base64",
        text: bodyBuffer.toString("base64"),
      }
    : {
        size: bodyBuffer.length,
        mimeType,
        text: bodyBuffer.toString("utf-8"),
      };
  return createResponse({
    status,
    statusText,
    httpVersion: "HTTP/1.1",
    headers,
    content,
    bodySize: bodyBuffer.length,
  });
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
      ? Readable.from([
          Buffer.from(
            request.postData.text,
            request.postData.encoding || "utf-8"
          ),
        ])
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

module.exports = {
  doRequest,
  readStreamText,
  getHarRequestFromNodeRequest,
  writeNodeResponseFromHarResponse,
  getHarResponseFromHarRequest,
};
