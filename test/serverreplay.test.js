const { run } = require("../src/serverreplay");
const {
  createHar,
  createEntry,
  createRequest,
  createResponse,
} = require("../src/har");
const { request } = require("./support/http");
const { AbortController } = require("abort-controller");

describe("serverreplay", () => {
  it("returns a correct HAR when making matching simple request", async () => {
    const harInput = createHar({
      entries: [
        createEntry({
          request: createRequest({
            method: "GET",
            url: "http://localhost/",
            httpVersion: "1.1",
            headers: [
              { name: "Host", value: "localhost" },
              { name: "Connection", value: "close" },
            ],
          }),
          response: createResponse({
            status: 200,
            statusText: "OK",
          }),
        }),
      ],
    });
    const abortController = new AbortController();
    let result;
    const promise = run({
      port: 80,
      harInput,
      abortController,
    }).then((_result) => {
      result = _result;
    });
    await request();
    abortController.abort();
    await promise;
    expect(result).toMatchInlineSnapshot(
      {
        log: { entries: [{ startedDateTime: expect.any(String) }] },
      },
      `
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
                "bodySize": -1,
                "content": Object {
                  "mimeType": "x-unknown",
                  "size": 0,
                },
                "cookies": Array [],
                "headers": Array [],
                "headersSize": -1,
                "httpVersion": "1.1",
                "redirectURL": "",
                "status": 200,
                "statusText": "OK",
              },
              "startedDateTime": Any<String>,
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
    `
    );
  });
});
