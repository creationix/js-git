"use strict";

var timeouts, messageName;

// node.js
if (typeof process === "object" && typeof process.nextTick === "function") {
  module.exports = process.nextTick;
}
// some browsers
else if (typeof setImmediate === "function") {
  module.exports = setImmediate;
}
// most other browsers
else {
  timeouts = [];
  messageName = "zero-timeout-message";
  window.addEventListener("message", handleMessage, true);

  module.exports = function (fn) {
    timeouts.push(fn);
    window.postMessage(messageName, "*");
  };
}

function handleMessage(event) {
  if (event.source == window && event.data == messageName) {
    event.stopPropagation();
    if (timeouts.length > 0) {
      var fn = timeouts.shift();
      fn();
    }
  }
}
