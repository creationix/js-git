"use strict";

module.exports = function (root, accessToken) {
  return function request(method, url, body, callback) {
    if (typeof body === "function" && callback === undefined) {
      callback = body;
      body = undefined;
    }
    url = url.replace(":root", root);
    if (!callback) return request.bind(this, accessToken, method, url, body);
    var json;
    var xhr = new XMLHttpRequest();
    xhr.open(method, 'https://api.github.com' + url, true);
    xhr.setRequestHeader("Authorization", "token " + accessToken);
    if (body) {
      xhr.setRequestHeader("Content-Type", "application/json");
      try { json = JSON.stringify(body); }
      catch (err) { return callback(err); }
    }
    xhr.onreadystatechange = onReadyStateChange;
    xhr.send(json);
    function onReadyStateChange() {
      if (xhr.readyState !== 4) return;
      var response;
      if (xhr.responseText) {
        try { response = JSON.parse(xhr.responseText); }
        catch (err) { return callback(err, null, xhr, response); }
      }
      return callback(null, xhr, response);
    }
  };
};
