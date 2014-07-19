"use strict";

module.exports = request;

function request(method, url, headers, body, callback) {
  if (typeof body === "function") {
    callback = body;
    body = undefined;
  }
  if (!callback) {
    return request.bind(null, method, url, headers, body);
  }
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.responseType = "arraybuffer";

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

    callback(null, {
      statusCode: xhr.status,
      headers: resHeaders,
      body: xhr.response && new Uint8Array(xhr.response)
    });
  };
  xhr.send(body);
}
