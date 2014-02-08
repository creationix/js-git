/*global define*/
define("js-git/lib/defer", function () {
  var timeouts = [];
  var messageName = "zero-timeout-message";

  function handleMessage(event) {
    if (event.source == window && event.data == messageName) {
      event.stopPropagation();
      if (timeouts.length > 0) {
        var fn = timeouts.shift();
        fn();
      }
    }
  }

  window.addEventListener("message", handleMessage, true);

  return function (fn) {
    timeouts.push(fn);
    window.postMessage(messageName, "*");
  };
});