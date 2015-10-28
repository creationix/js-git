"use strict";
let timeouts, messageName;
if (typeof process === "object" && typeof process.nextTick === "function") {
    exports = process.nextTick;
}
else if (typeof setImmediate === "function") {
    exports = setImmediate;
}
else {
    timeouts = [];
    messageName = "zero-timeout-message";
    window.addEventListener("message", handleMessage, true);
    exports = function (fn) {
        timeouts.push(fn);
        window.postMessage(messageName, "*");
    };
}
function handleMessage(event) {
    if (event.source == window && event.data == messageName) {
        event.stopPropagation();
        if (timeouts.length > 0) {
            let fn = timeouts.shift();
            fn();
        }
    }
}
