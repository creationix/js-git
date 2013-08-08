var platform = require('../lib/platform.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var framer = pushToPull(require('../lib/pkt-line.js').framer);
var writable = require('../helpers/writable.js');
var ssh = platform.require('ssh');
var agent = platform.require('agent');

// opts.hostname - host to connect to (github.com)
// opts.pathname - path to repo (/creationix/conquest.git)
// opts.port - override default port (22)
// opts.auth - username:password or just username
// opts.privateKey - binary contents of private key to use.
module.exports = function (opts) {
  if (!opts.hostname) throw new TypeError("hostname is a required option");
  if (!opts.pathname) throw new TypeError("pathname is a required option");
  opts.port = opts.port ? opts.port | 0 : 22;

  var connection;

  return {
    discover: discover,
    negotiate: negotiate,
    close: close
  };

  function connect(callback) {
    if (connection) return callback();
    ssh(opts, function (err, result) {
      if (err) return callback(err);
      connection = result;
      callback();
    });
  }

  // Send initial git-upload-pack request
  // outputs refs and caps
  function discover(callback) {
    if (!callback) return discover.bind(this);
    if (!connection) {
      return connect(function (err) {
        if (err) return callback(err);
        return discover(callback);
      });
    }
    var refs = {};
    var caps = null;
    var read, abort, write;

    connection.exec("git-upload-pack", function (err, socket) {
      if (err) return callback(err);
      var input = deframer(socket);
      if (opts.trace) input = opts.trace("input", input);

      read = input.read;
      abort = input.abort;
      write = writable(abort);
      var output = write;
      if (opts.trace) output = opts.trace("output", output);
      output = framer(output);
      socket.sink(output)(function (err) {
        throw err;
        // TODO: handle this better somehow
        // maybe allow writable streams
      });
      read(onLine);
    });

    function onLine(err, line) {
      if (err) return callback(err);
      if (line === null) {
        return callback(null, {
          refs: refs,
          caps: caps
        });
      }
      line = line.trim();
      if (!caps) line = pullCaps(line);
      var index = line.indexOf(" ");
      refs[line.substr(index + 1)] = line.substr(0, index);
      read(onLine);
    }

    function pullCaps(line) {
      var index = line.indexOf("\0");
      caps = {};
      line.substr(index + 1).split(" ").map(function (cap) {
        var pair = cap.split("=");
        caps[pair[0]] = pair[1] || true;
      });
      return line.substr(0, index);
    }
  }

  function negotiate(callback) {
    if (!callback) return negotiate.bind(this);
    if (!read) return callback(new Error("Can't negotiate till connected"));
    throw new Error("TODO: Implement tcp negotiate");
  }

  function close(callback) {
    if (!callback) return close.bind(this);
    connection.close(callback);
  }

};

