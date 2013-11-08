var trace = require('./trace.js');

module.exports = function (db) {
  return {
    get: wrap1("get", db.get),
    set: wrap2("set", db.set),
    has: wrap1("has", db.has),
    del: wrap1("del", db.del),
    keys: wrap1("keys", db.keys),
    init: wrap0("init", db.init),
  };
};

function wrap0(type, fn) {
  return zero;
  function zero(callback) {
    if (!callback) return zero.bind(this);
    return fn.call(this, check);
    function check(err) {
      if (err) return callback(err);
      trace(type, null);
      return callback.apply(this, arguments);
    }
  }
}

function wrap1(type, fn) {
  return one;
  function one(arg, callback) {
    if (!callback) return one.bind(this, arg);
    return fn.call(this, arg, check);
    function check(err) {
      if (err) return callback(err);
      trace(type, null, arg);
      return callback.apply(this, arguments);
    }
  }
}

function wrap2(type, fn) {
  return two;
  function two(arg1, arg2, callback) {
    if (!callback) return two.bind(this, arg1. arg2);
    return fn.call(this, arg1, arg2, check);
    function check(err) {
      if (err) return callback(err);
      trace(type, null, arg1);
      return callback.apply(this, arguments);
    }
  }
}

