const { run } = require("../src/proxy");
const AbortController = require("abort-controller");
const { Readable } = require("stream");
const { DEFAULT_HOSTNAME, startServer, request } = require("./support/http");

const SOURCE_PORT = 80;
const TARGET_PORT = 81;

async function runProxy(block) {
  let result;
  const abortController = new AbortController();
  const runningProxy = run({
    listenHost: DEFAULT_HOSTNAME,
    listenPort: SOURCE_PORT,
    connectHost: DEFAULT_HOSTNAME,
    connectPort: TARGET_PORT,
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
    await startServer({
      port: TARGET_PORT,
    });
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
    await startServer({
      port: TARGET_PORT,
    });
    const result = await runProxy(async () => {
      await request({
        port: SOURCE_PORT,
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
    await startServer({
      port: TARGET_PORT,
    });
    const result = await runProxy(async () => {
      await request({
        port: SOURCE_PORT,
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
