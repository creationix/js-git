var platform = require('../lib/platform.js');
var http = platform.require("http");
var agent = platform.require("agent");
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var trace = platform.require('trace');
var sharedDiscover = require('./discover.js');

// opts.hostname - host to connect to (github.com)
// opts.pathname - path to repo (/creationix/conquest.git)
// opts.tls - true or false (https vs http, defaults to false)
// opts.port - override default port (80 for http, 443 for https)
module.exports = function (opts) {
  opts.tls = !!opts.tls;
  opts.port = opts.port ? opts.port | 0 : (opts.tls ? 443 : 80);
  if (!opts.hostname) throw new TypeError("hostname is a required option");
  if (!opts.pathname) throw new TypeError("pathname is a required option");

  return {
    discover: discover,
    negotiate: negotiate,
    close: close
  };

  // Send initial git-upload-pack request
  // outputs refs and caps
  function discover(callback) {
    if (!callback) return discover.bind(this);
      var headers = {
      "User-Agent": agent,
      "Host": opts.hostname,
      "Accept": "*/*",
      "Accept-Encoding": "gzip",
      "Pragma": "no-cache"
    };

    http.request({
      method: "GET",
      hostname: opts.hostname,
      tls: opts.tls,
      port: opts.port,
      path: opts.pathname + "/info/refs?service=git-upload-pack",
      auth: opts.auth,
      headers: headers
    }, function (err, code, headers, body) {
      if (err) return callback(err);
      if (code !== 200) return callback(new Error("Unexpected status code " + code));
      if (headers['content-type'] !== 'application/x-git-upload-pack-advertisement') {
        return callback(new Error("Wrong content-type in server response"));
      }

      body = deframer(body);
      if (trace) body = trace("input", body);

      body.read(function (err, line) {
        if (err) return callback(err);
        if (line.trim() !== '# service=git-upload-pack') {
          return callback(new Error("Missing expected service line"));
        }
        body.read(function (err, line) {
          if (err) return callback(err);
          if (line !== null) {
            return callback(new Error("Missing expected terminator"));
          }
          sharedDiscover(body, callback);
        });
      });
    });
  }

  function negotiate(callback) {
    if (!callback) return negotiate.bind(this);
    throw new Error("TODO: Implement smart-http negotiate");
  }

  function close(callback) {
    if (!callback) return close.bind(this);
    callback();
  }

}
