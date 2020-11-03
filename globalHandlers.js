const sharedHandlers = {};

function on(event, callback) {
  sharedHandlers[event] = callback;
}

function ignore(event) {
  delete sharedHandlers[event];
}

function getHandler(event) {
  return sharedHandlers[event];
}

module.exports = {
  getHandler,
  ignore,
  on,
};
