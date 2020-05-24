const { run } = require("../src/proxy");
const { doRequest } = require("../src/node-conversion");
const AbortController = require("abort-controller");
const http = require("http");
const { readStreamText } = require("../src/node-conversion");
const { runServer } = require("../src/server");
const { Readable } = require("stream");

const DEFAULT_HOSTNAME = "localhost";
const DEFAULT_LISTEN_PORT = 80;
const DEFAULT_PROXY_PORT = 81;
const DEFAULT_HANDLER = (req, res) => res.end();

async function startServer(
  { hostname = DEFAULT_HOSTNAME, port = DEFAULT_PROXY_PORT },
  handler = DEFAULT_HANDLER
) {
  const server = http.createServer((req, res) => {
    res.sendDate = false;
    return handler(req, res);
  });
  await new Promise((resolve) => server.listen(port, hostname, 1, resolve));
  return server;
}

async function request(options) {
  const response = await doRequest({
    protocol: http,
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_LISTEN_PORT,
    url: "/",
    ...options,
  });
  response.body = await readStreamText(response);
  return response;
}

async function runProxy(block) {
  let result;
  const abortController = new AbortController();
  const runningProxy = run({
    listenHost: DEFAULT_HOSTNAME,
    listenPort: DEFAULT_LISTEN_PORT,
    connectHost: DEFAULT_HOSTNAME,
    connectPort: DEFAULT_PROXY_PORT,
    signal: abortController.signal,
  }).then((_result) => {
    result = _result;
  });

  await block();
  abortController.abort();
  await runningProxy;

  for (const entry of result.log.entries) {
    delete entry.startedDateTime;
  }

  return result;
}

describe("proxy", () => {
  it("returns a correct HAR when there is no request", async () => {
    await startServer({});
    const result = await runProxy(() => {});
    expect(result).toMatchInlineSnapshot(`
      Object {
        "log": Object {
          "creator": Object {
            "name": "harhar",
            "version": "",
          },
          "entries": Array [],
          "version": "1.2",
        },
      }
    `);
  });

  it("returns a correct HAR when there is a single GET request", async () => {
    await startServer({});
    const result = await runProxy(async () => {
      await request({});
    });
    expect(result).toMatchInlineSnapshot(`
      Object {
        "log": Object {
          "creator": Object {
            "name": "harhar",
            "version": "",
          },
          "entries": Array [
            Object {
              "cache": Object {},
              "request": Object {
                "bodySize": -1,
                "headers": Array [
                  Object {
                    "name": "Host",
                    "value": "localhost",
                  },
                  Object {
                    "name": "Connection",
                    "value": "close",
                  },
                ],
                "headersSize": -1,
                "httpVersion": "1.1",
                "method": "GET",
                "postData": undefined,
                "queryString": Array [],
                "url": "http://localhost/",
              },
              "response": Object {
                "bodySize": 0,
                "content": Object {
                  "mimeType": undefined,
                  "size": 0,
                  "text": "",
                },
                "cookies": Object {},
                "headers": Array [
                  Object {
                    "name": "Connection",
                    "value": "close",
                  },
                  Object {
                    "name": "Content-Length",
                    "value": "0",
                  },
                ],
                "headersSize": -1,
                "httpVersion": "HTTP/1.1",
                "redirectURL": "",
                "status": 200,
                "statusText": "OK",
              },
              "time": -1,
              "timings": Object {
                "receive": -1,
                "send": -1,
                "wait": -1,
              },
            },
          ],
          "version": "1.2",
        },
      }
    `);
  });
  it("returns a correct HAR when there is a single POST request", async () => {
    await startServer({});
    const result = await runProxy(async () => {
      await request({
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: Readable.from(["this is the request body"]),
      });
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "log": Object {
          "creator": Object {
            "name": "harhar",
            "version": "",
          },
          "entries": Array [
            Object {
              "cache": Object {},
              "request": Object {
                "bodySize": -1,
                "headers": Array [
                  Object {
                    "name": "Host",
                    "value": "localhost",
                  },
                  Object {
                    "name": "Connection",
                    "value": "close",
                  },
                  Object {
                    "name": "Content-Type",
                    "value": "text/plain",
                  },
                ],
                "headersSize": -1,
                "httpVersion": "1.1",
                "method": "POST",
                "postData": Object {
                  "encoding": undefined,
                  "mimeType": "text/plain",
                  "text": "this is the request body",
                },
                "queryString": Array [],
                "url": "http://localhost/",
              },
              "response": Object {
                "bodySize": 0,
                "content": Object {
                  "mimeType": undefined,
                  "size": 0,
                  "text": "",
                },
                "cookies": Object {},
                "headers": Array [
                  Object {
                    "name": "Connection",
                    "value": "close",
                  },
                  Object {
                    "name": "Content-Length",
                    "value": "0",
                  },
                ],
                "headersSize": -1,
                "httpVersion": "HTTP/1.1",
                "redirectURL": "",
                "status": 200,
                "statusText": "OK",
              },
              "time": -1,
              "timings": Object {
                "receive": -1,
                "send": -1,
                "wait": -1,
              },
            },
          ],
          "version": "1.2",
        },
      }
    `);
  });
});
