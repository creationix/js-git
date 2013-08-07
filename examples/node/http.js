var wrapStream = require('./stream.js').wrapStream;

module.exports = {
  request: request
};

function request(opts, callback) {
  var base = opts.tls ? require('https') : require('http');
  if (opts.trace) opts.trace("output", null, toLine(opts));
  var req = base.request(opts, function (res) {
    callback(null, res.statusCode, res.headers, wrapStream(res));
  });
  req.end();
}

function toLine(opts) {
  return opts.method + " " + opts.hostname + ":" + opts.port + " " + opts.path;
}
