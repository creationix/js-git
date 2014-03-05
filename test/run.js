// Ultra simple test runner with TAP output.

var inspect = require('util').inspect;
var defer = require('../lib/defer.js');
var log = console.log;
console.log = function () {
  var args = [].slice.call(arguments).map(function (arg) {
    return inspect(arg, {colors:true});
  });
  log(args.join(" ").split("\n").map(function (line) {
    return "# " + line;
  }).join("\n"));
};

module.exports = function (tests) {
  var timeout;
  var test;
  var index = 0;
  log("1.." + (tests.length));
  next();
  function next(err) {
    if (timeout) clearTimeout(timeout);
    if (index) {
      if (err) {
        log(err.stack.split("\n").map(function (line) {
          return "# " + line;
        }).join("\n"));
        log("not ok " + index + " - " + test.name);
      }
      else {
        log("ok " + index + " - " + test.name);
      }
    }
    test = tests[index++];
    if (!test) return;
    timeout = setTimeout(onTimeout, 1000);
    try {
      if (test.length) test(next);
      else test();
    }
    catch (err) { return next(err); }
    if (!test.length) defer(next);
  }

  function onTimeout() {
    next(new Error("Test timeout"));
  }
};