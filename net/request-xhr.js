// -*- mode: js; js-indent-level: 2; -*-

"use strict";

module.exports = request;

function request(method, url, headers, body, callback, responseType) {
  if (typeof body === "function") {
    callback = body;
    body = undefined;
  }
  if (!callback) {
    return request.bind(null, method, url, headers, body);
  }
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  if (!responseType) {
    responseType = "arraybuffer";
  }
  xhr.responseType = responseType;

  Object.keys(headers).forEach(function (name) {
    xhr.setRequestHeader(name, headers[name]);
  });

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var resHeaders = {};
    xhr.getAllResponseHeaders().trim().split("\r\n").forEach(function (line) {
      var index = line.indexOf(":");
      resHeaders[line.substring(0, index).toLowerCase()] = line.substring(index + 1).trim();
    });

    var body = xhr.response;
    if (body && xhr.responseType == "arraybuffer") {
      body = new Uint8Array(body);
    }

    callback(null, {
      statusCode: xhr.status,
      headers: resHeaders,
      body: body
    });
  };
  xhr.send(body);
}
