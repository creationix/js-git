var wrapStream = require('./stream.js').wrapStream;
var trace = require('./trace.js');
var bops = require('bops');

module.exports = {
  request: request
};

function request(opts, callback) {
  var base = opts.tls ? require('https') : require('http');
  if (trace) trace("request", null, {
    method: opts.method,
    host: opts.hostname,
    port: opts.port,
    path: opts.path,
    headers: opts.headers
  });
  var req = base.request(opts, function (res) {
    if (trace) trace("response", null, {
      code: res.statusCode,
      headers: res.headers
    });
    callback(null, res.statusCode, res.headers, wrapStream(res));
  });
  var body = opts.body;
  if (body) {
    if (bops.is(body) || typeof body === "string") {
      req.end(body);
    }
    else {
      body.read(onRead);
    }
  }
  else req.end();
  function onRead(err, item) {
    if (err) return callback(err);
    if (item === undefined) {
      return req.end();
    }
    req.write(item);
    body.read(onRead);
  }
}
