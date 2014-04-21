"use strict";

// Node.js https module
if (typeof process === 'object' && typeof process.versions === 'object' && process.versions.node) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  module.exports = nodeRequire('./xhr-node.js');
}

// Browser XHR
else {
  module.exports = function (root, accessToken) {
    return function request(method, url, body, callback) {
      if (typeof body === "function" && callback === undefined) {
        callback = body;
        body = undefined;
      }
      url = url.replace(":root", root);
      if (!callback) return request.bind(this, accessToken, method, url, body);
      var done = false;
      var json;
      var xhr = new XMLHttpRequest();
      xhr.timeout = 8000;
      xhr.open(method, 'https://api.github.com' + url, true);
      xhr.setRequestHeader("Authorization", "token " + accessToken);
      if (body) {
        xhr.setRequestHeader("Content-Type", "application/json");
        try { json = JSON.stringify(body); }
        catch (err) { return callback(err); }
      }
      xhr.ontimeout = onTimeout;
      xhr.onreadystatechange = onReadyStateChange;
      xhr.send(json);

      function onReadyStateChange() {
        if (done) return;
        if (xhr.readyState !== 4) return;
        // Give onTimeout a chance to run first if that's the reason status is 0.
        if (!xhr.status) return setTimeout(onReadyStateChange, 0);
        done = true;
        var response = {message:xhr.responseText};
        if (xhr.responseText){
          try { response = JSON.parse(xhr.responseText); }
          catch (err) {}
        }
        return callback(null, xhr, response);
      }

      function onTimeout() {
        if (done) return;
        done = true;
        callback(new Error("Timeout requesting " + url));
      }
    };
  };
}