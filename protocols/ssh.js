var platform = require('../lib/platform.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var framer = pushToPull(require('../lib/pkt-line.js').framer);
var writable = require('../helpers/writable.js');
var ssh = platform.require('ssh');
var trace = platform.require('trace');
var sharedFetch = require('./fetch.js');
var sharedDiscover = require('./discover.js');

// opts.hostname - host to connect to (github.com)
// opts.pathname - path to repo (/creationix/conquest.git)
// opts.port - override default port (22)
// opts.auth - username:password or just username
// opts.privateKey - binary contents of private key to use.
module.exports = function (opts) {
  if (!opts.hostname) throw new TypeError("hostname is a required option");
  if (!opts.pathname) throw new TypeError("pathname is a required option");
  opts.port = opts.port ? opts.port | 0 : 22;

  var tunnel, connection;

  return {
    discover: discover,
    fetch: fetch,
    close: closeConnection
  };

  function connect(command, callback) {
    if (connection) return callback();
    ssh(opts, function (err, result) {
      if (err) return callback(err);
      tunnel = result;
      tunnel.exec(command, function (err, socket) {
        if (err) return callback(err);
        var input = deframer(socket);
        if (trace) input = trace("input", input);

        var output = writable(input.abort);
        connection = {
          read: input.read,
          abort: input.abort,
          write: output
        };
        if (trace) output = trace("output", output);
        output = framer(output);
        socket.sink(output)(function (err) {
          throw err;
          // TODO: handle this better somehow
          // maybe allow writable streams
        });
        callback();
      });
    });
  }

  // Send initial git-upload-pack request
  // outputs refs and caps
  function discover(callback) {
    if (!callback) return discover.bind(this);
    if (!connection) {
      return connect("git-upload-pack", function (err) {
        if (err) return callback(err);
        return discover(callback);
      });
    }
    sharedDiscover(connection, callback);
  }

  function fetch(opts, callback) {
    if (!callback) return fetch.bind(this, opts);
    discover(function (err, refs, caps) {
      if (err) return callback(err);
      opts.refs = refs;
      opts.caps = caps;
      sharedFetch(connection, opts, callback);
    });
  }

  function closeConnection(callback) {
    if (!callback) return close.bind(this);
    connection.write();
    tunnel.close(function (err) {
      if (err) return callback(err);
      callback(null, result);
    });
  }

};

