var wrapStream = require('./stream.js').wrapStream;
var trace = require('./trace.js');

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
  if (opts.body) req.end(opts.body);
  else req.end();
}
