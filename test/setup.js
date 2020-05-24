const winston = require("winston");

winston.configure({
  silent: true,
});

jest.mock("http");
