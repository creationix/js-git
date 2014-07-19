"use strict";

module.exports = wrapHandler;

function wrapHandler(fn, onError) {
  if (onError) {
    return function (err, value) {
      if (err) return onError(err);
      try {
        return fn(value);
      }
      catch (err) {
        return onError(err);
      }
    };
  }
  return function (err, value) {
    if (err) throw err;
    return fn(value);
  };
}
