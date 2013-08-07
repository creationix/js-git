var wrapStream = require('./stream.js').wrapStream;

module.exports = {
  request: request
};

function request(opts, callback) {
  var base = opts.tls ? require('https') : require('http');
  if (opts.trace) opts.trace("request", null, toLine(opts));
  var req = base.request(opts, function (res) {
    if (opts.trace) opts.trace("response", null, [res.statusCode, res.headers]);
    callback(null, res.statusCode, res.headers, wrapStream(res));
  });
  req.end();
}

function toLine(opts) {
  return opts.method + " " + opts.hostname + ":" + opts.port + " " + opts.path;
}
