const { run } = require("../src/proxy");
const { doRequest } = require("../src/node-conversion");
const AbortController = require("abort-controller");
const http = require("http");
const { readStreamText } = require("../src/node-conversion");
const { runServer } = require("../src/server");

async function testProxy({
  requestHandler,
  block,
  withStartedDateTime = false,
}) {
  const abortController = new AbortController();

  async function request(options) {
    return await doRequest({
      protocol: http,
      hostnam: "127.0.0.1",
      port: 8080,
      url: "/",
      ...options,
    });
  }

  try {
    const server = http.createServer((req, res) => {
      res.sendDate = false;
      return requestHandler(req, res);
    });

    runServer({
      server,
      port: 8081,
      hostname: "127.0.0.1",
      signal: abortController.signal,
    });

    let result;
    const runningProxy = run({
      listenHost: "127.0.0.1",
      listenPort: 8080,
      connectHost: "127.0.0.1",
      connectPort: 8081,
      signal: abortController.signal,
    }).then((_result) => {
      result = _result;
    });

    await block(request);
    abortController.abort();
    await runningProxy;

    if (!withStartedDateTime) {
      for (const entry of result.log.entries) {
        delete entry.startedDateTime;
      }
    }

    return result;
  } catch (e) {
    abortController.abort();
    throw e;
  }
}

describe("proxy", () => {
  it("no request", async () => {
    const result = await testProxy({
      requestHandler: (req, res) => {
        res.end();
      },
      block: () => {},
    });
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

  it("empty request", async () => {
    const result = await testProxy({
      requestHandler: (req, res) => {
        res.end();
      },
      block: async (request) => {
        const response = await request({
          url: "/",
        });
        await readStreamText(response);
      },
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
                    "value": "localhost:8080",
                  },
                  Object {
                    "name": "Connection",
                    "value": "close",
                  },
                ],
                "headersSize": -1,
                "httpVersion": "1.1",
                "method": "GET",
                "postData": Object {
                  "mimeType": undefined,
                  "text": "",
                },
                "queryString": Array [],
                "url": "http://localhost:8080/",
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
