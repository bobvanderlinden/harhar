const winston = require("winston");

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

module.exports = {
  collect,
  createCommandAction,
};
