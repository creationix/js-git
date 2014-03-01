"use strict";

// Node.js https module
if (typeof process === 'object' && typeof process.versions === 'object' && process.versions.node) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  var https = nodeRequire('https');
  var statusCodes = nodeRequire('http').STATUS_CODES;
  module.exports = function (root, accessToken) {
    var cache = {};
    return function request(method, url, body, callback) {
      if (typeof body === "function" && callback === undefined) {
        callback = body;
        body = undefined;
      }
      if (!callback) return request.bind(this, accessToken, method, url, body);
      url = url.replace(":root", root);

      var json;
      var headers = {
        "User-Agent": "node.js"
      };
      if (accessToken) {
        headers["Authorization"] = "token " + accessToken;
      }
      if (body) {
        headers["Content-Type"] = "application/json";
        try { json = JSON.stringify(body); }
        catch (err) { return callback(err); }
      }
      if (method === "GET") {
        var cached = cache[url];
        if (cached) {
          headers["If-None-Match"] = cached.etag;
        }
      }
      var options = {
        hostname: "api.github.com",
        path: url,
        method: method,
        headers: headers
      };
      var req = https.request(options, function (res) {
        var response;
        var body = [];
        res.on("data", function (chunk) {
          body.push(chunk);
        });
        res.on("end", function () {
          body = Buffer.concat(body).toString();
          console.log(method, url, res.statusCode);
          console.log("Rate limit %s/%s left", res.headers['x-ratelimit-remaining'], res.headers['x-ratelimit-limit']);
          if (res.statusCode >= 400 && res.statusCode < 500) return callback();
          else if (res.statusCode === 200 && method === "GET" && /\/refs\//.test(url)) {
            cache[url] = {
              body: body,
              etag: res.headers.etag
            };
          }
          else if (res.statusCode === 304) {
            body = cache[url].body;
          }
          else if (res.statusCode < 200 || res.statusCode >= 300) {
            return callback(new Error("Invalid HTTP response: " + res.statusCode));
          }

          var response = {message:body};
          if (body){
            try { response = JSON.parse(body); }
            catch (err) {}
          }

          // Fake parts of the xhr object using node APIs
          var xhr = {
            status: res.statusCode,
            statusText: res.statusCode + " " + statusCodes[res.statusCode]
          };
          return callback(null, xhr, response);
        });
      });
      req.end(json);
      req.on("error", callback);
    };
  };
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
      xhr.timeout = 4000;
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