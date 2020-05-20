const winston = require("winston");

winston.configure({
  silent: true,
});

jest.mock("http", () => {
  const { PassThrough } = require("stream");
  const { EventEmitter } = require("events");
  const servers = {};

  class MemoryStream extends PassThrough {}

  class Agent {
    constructor({ keepAlive = false }) {
      this.keepAlive = keepAlive;
    }
  }

  class HttpResponse extends MemoryStream {
    constructor() {
      super();
      this.statusCode = 200;
      this.statusMessage = "OK";
      this.headerPairs = [];
      this.socket = {
        destroy: () => {
          this.destroy();
        },
      };
    }
    get headers() {
      return Object.fromEntries(this.headerPairs);
    }

    get rawHeaders() {
      return this.headerPairs.flatMap(([key, value]) => [key, value]);
    }

    removeHeader(name) {
      this.headerPairs = this.headerPairs.filter(
        ([key]) => key.toLowerCase() !== name.toLowerCase()
      );
    }

    setHeader(name, value) {
      const headerValues =
        typeof value === "string"
          ? [value]
          : Array.isArray(value)
          ? value
          : typeof value === "number"
          ? [value.toString()]
          : [];
      const newHeaders = headerValues.map((headerValue) => [name, headerValue]);
      const headerIndex = this.headerPairs.findIndex(
        ([key]) => key.toLowerCase() === name.toLowerCase()
      );
      if (headerIndex < 0) {
        this.headerPairs = this.headerPairs.concat(newHeaders);
      } else {
        const oldHeaders = this.headerPairs.filter(
          ([key]) => key.toLowerCase() !== name.toLowerCase()
        );
        this.headerPairs = [
          ...oldHeaders.slice(0, headerIndex),
          ...newHeaders,
          ...oldHeaders.slice(headerIndex),
        ];
      }
    }

    getHeader(name) {
      const values = this.headerPairs
        .filter(([key]) => key.toLowerCase() === name.toLowerCase())
        .map(([, value]) => value);
      if (values.length === 0) {
        return undefined;
      } else if (values.length === 1) {
        return values[0];
      } else {
        return values;
      }
    }
  }

  class HttpServer extends EventEmitter {
    constructor(handler) {
      super();
      this.handler = handler;
    }
    request(options, onResponse) {
      const agent = options.agent || new Agent({});
      const req = new MemoryStream();
      req.httpVersion = "1.1";
      req.method = (options.method || "GET").toUpperCase();
      req.url = options.url;
      const url = new URL("http://localhost/");
      if (options.host) {
        url.host = options.host;
      }
      if (options.hostname) {
        url.hostname = options.hostname;
      }
      if (options.port) {
        url.port = options.port;
      }
      const headers = {
        Host: url.host,
        Connection: agent.keepAlive ? "keep-alive" : "close",
        ...options.headers,
      };
      req.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ])
      );
      req.rawHeaders = Object.entries(headers).flatMap(([key, value]) => [
        key,
        value,
      ]);
      const res = new HttpResponse();
      res.statusCode = 200;
      res.statusMessage = "OK";
      res.setHeader("Connection", "close");
      res.setHeader("Content-Length", "0");
      this.handler(req, res);
      onResponse(res);
      return req;
    }
    listen(
      port = 80,
      address = "localhost",
      backlog = 99,
      callback = undefined
    ) {
      if (!(callback instanceof Function)) {
        throw new Error("not supported");
      }
      this.port = port;
      this.address = address;
      this.backlog = backlog;
      servers[`${port}`] = this;
      setImmediate(() => {
        callback();
      });
    }
    close() {
      delete servers[`${this.port}`];
    }
  }

  function createServer(handler) {
    return new HttpServer(handler);
  }

  function request(options, onResponse) {
    const server = servers[`${options.port}`];
    return server.request(options, onResponse);
  }

  return {
    createServer,
    request,
    Agent,
  };
});
