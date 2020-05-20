const winston = require("winston");
const { AbortController } = require("abort-controller");

function collect(val, memo) {
  memo.push(val);
  return memo;
}

function createCommandAction(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      winston.error(e);
      winston.error(e.stack);
      throw e;
    }
  };
}

function createAbortController() {
  const abortController = new AbortController();

  function abort() {
    abortController.abort();
  }

  process.on("SIGINT", abort);
  process.on("SIGTERM", abort);

  return abortController;
}

module.exports = {
  collect,
  createCommandAction,
  createAbortController,
};
