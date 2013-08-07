var Connection = require('ssh2');
var wrapStream = require('./stream.js').wrapStream;
var Duplex = require('stream').Duplex;

module.exports = function (opts, callback) {
  var config = {
    host: opts.hostname,
    port: opts.port,
  };
  var parts = opts.auth && opts.auth.split(":") || [];
  if (parts[0]) {
    config.username = parts[0];
  }
  else {
    config.username = process.env.USER || process.env.USERNAME;
  }
  if (parts[1]) {
    config.password = parts[1];
  }
  else if (opts.privateKey) {
    config.privateKey = opts.privateKey;
  }
  else {
    config.privateKey = require('fs').readFileSync(process.env.HOME + "/.ssh/id_rsa");
  }
  if (opts.pathname.substr(0, 2) === "/:") opts.pathname = opts.pathname.substr(2);

  var c = new Connection();
  c.on("ready", onReady);
  c.on("error", onError);
  c.connect(config);
  function clear() {
    c.removeListener("ready", onReady);
    c.removeListener("error", onError);
  }
  function onError(err) {
    clear();
    callback(err);
  }
  function onReady() {
    if (opts.trace) opts.trace("connect", null, {
      host: config.username + "@" + config.host,
      port: config.port,
    });
    clear();
    callback(null, {
      exec: exec,
      close: close
    });
  }

  function exec(command, callback) {
    command += " " + opts.pathname;
    if (opts.trace) opts.trace("exec", null, command);
    c.exec(command, function (err, stream) {
      if (err) return callback(err);
      callback(null, wrapStream((new Duplex).wrap(stream)));
    });
  }

  function close(callback) {
    c.end(callback);
  }

};
