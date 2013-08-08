var platform = require('../lib/platform.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var framer = pushToPull(require('../lib/pkt-line.js').framer);
var writable = require('../helpers/writable.js');
var tcp = platform.require('tcp');
var agent = platform.require('agent');

// opts.hostname - host to connect to (github.com)
// opts.pathname - path to repo (/creationix/conquest.git)
// opts.port - override default port (9418)
module.exports = function (opts) {
  if (!opts.hostname) throw new TypeError("hostname is a required option");
  if (!opts.pathname) throw new TypeError("pathname is a required option");
  opts.port = opts.port ? opts.port | 0 : 9418;

  var read, abort, write;

  return {
    discover: discover,
    negotiate: negotiate,
    close: close
  };

  function connect(callback) {
    return tcp.connect(opts.port, opts.hostname, function (err, socket) {
      if (err) return callback(err);
      if (opts.trace) opts.trace("connect", null, {
        host: opts.hostname,
        port: opts.port
      });
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
      callback();
    });
  }

  // Send initial git-upload-pack request
  // outputs refs and caps
  function discover(callback) {
    if (!callback) return discover.bind(this);
    if (!read) {
      return connect(function (err) {
        if (err) return callback(err);
        return discover(callback);
      });
    }
    var refs = {};
    var caps = null;

    write("git-upload-pack " + opts.pathname + "\0host=" + opts.hostname + "\0");
    read(onLine);

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

  function negotiate(wants, opts, callback) {
    var serverCaps = opts.serverCaps;
    if (!callback) return negotiate.bind(this);
    if (!read) return callback(new Error("Can't negotiate till connected"));
    var caps = [];
    if (serverCaps["ofs-delta"]) caps.push("ofs-delta");
    if (opts.includeTag && serverCaps["include-tag"]) caps.push("include-tag");
    if ((opts.onProgress || opts.onError) &&
        (serverCaps["side-band-64k"] || serverCaps["side-band"])) {
      caps.push(serverCaps["side-band-64k"] ? "side-band-64k" : "side-band");
      if (!opts.onProgress && serverCaps["no-progress"]) {
        caps.push("no-progress");
      }
    }
    if (serverCaps.agent) caps.push("agent=" + agent);
    wants[0] += " " + caps.join(" ");
    wants.forEach(function (want) {
      write(want + "\n");
    });
    write(null);
    write("done\n");
    var packStream = writable(abort);

    read(function (err, nak) {
      if (err) return callback(err);
      if (nak.trim() !== "NAK") {
        return callback(Error("Expected NAK"));
      }
      callback(null, {
        read: packStream.read,
        abort: packStream.abort
      });
      read(onItem);
    });

    function onItem(err, item) {
      if (err) return packStream.error(err);
      if (item) {
        if (item.progress) {
          if (opts.onProgress) opts.onProgress(item.progress);
        }
        else if (item.error) {
          if (opts.onError) opts.onError(item.error);
        }
        else {
          packStream(item);
        }
      }
      if (item === undefined) {
        packStream(undefined);
      }
      else read(onItem);
    }
  }

  function close(callback) {
    if (!callback) return close.bind(this);
    if (write) {
      write(null);
      write();
    }
    if (abort) {
      return abort(callback);
    }
    callback();
  }

}
