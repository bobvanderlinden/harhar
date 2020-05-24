const http = require("http");
const { readStreamText } = require("../src/node-conversion");

describe("http", () => {
  it("when hosting server on port 80 we can respond with data", () => {
    return new Promise((cb) => {
      expect.assertions(1);
      const server = http.createServer((req, res) => {
        res.write("data");
        res.end();
      });
      server.listen(80, "localhost", 0, () => {});
      http
        .request(
          {
            hostname: "localhost",
            port: 80,
            url: "/",
          },
          (response) => {
            response.on("data", (data) => {
              expect(data.toString()).toBe("data");
            });
            response.on("end", () => {
              cb();
            });
          }
        )
        .end();
    });
  });

  it("when hosting 2 servers we can send and receive requests individually", () => {
    return new Promise((cb) => {
      expect.assertions(2);
      http
        .createServer((req, res) => {
          res.write("this is server1");
          res.end();
        })
        .listen(80, "localhost", 0, () => {});
      http
        .createServer((req, res) => {
          res.write("this is server2");
          res.end();
        })
        .listen(81, "localhost", 0, () => {});
      http
        .request(
          {
            hostname: "localhost",
            port: 80,
            url: "/",
          },
          (response) => {
            response.on("data", (data) => {
              expect(data.toString()).toBe("this is server1");
            });
            response.on("end", () => {});
          }
        )
        .end();
      http
        .request(
          {
            hostname: "localhost",
            port: 81,
            url: "/",
          },
          (response) => {
            response.on("data", (data) => {
              expect(data.toString()).toBe("this is server2");
            });
            response.on("end", () => {
              cb();
            });
          }
        )
        .end();
    });
  });

  it("when hosting a server we send post data", () => {
    return new Promise((done) => {
      expect.assertions(2);
      http
        .createServer(async (req, res) => {
          const body = await readStreamText(req);
          expect(body).toBe("this is post data");
          res.end();
        })
        .listen(80, "localhost", 0, () => {});
      const request = http.request(
        {
          host: "localhost",
          port: 80,
          url: "/",
        },
        async (response) => {
          const responseBodyText = await readStreamText(response);
          expect(responseBodyText).toBe("");
          done();
        }
      );
      request.write("this is post data");
      request.end();
    });
  });
});
