const { module } = require("window-or-global");

const globalHandlers = {};

function on(event, callback) {
  globalHandlers[event] = callback;
}

function ignore(event) {
  delete globalHandlers[event];
}

function getHandler(event) {
  return globalHandlers[event];
}

module.exports = {
  getHandler,
  ignore,
  on,
};
