var extract = require('../helpers/extract.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var framer = pushToPull(require('../lib/pkt-line.js').framer);
var writable = require('../lib/writable.js');

module.exports = tcpTransport;
function tcpTransport(platform) {
  var tcp = extract(platform, "tcp");
  var agent = extract(platform, "agent");

  return setup;

  // opts.hostname - host to connect to (github.com)
  // opts.pathname - path to repo (/creationix/conquest.git)
  // opts.port - override default port (9418)
  function setup(opts) {
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
      var refs = {};
      var caps = null;
      connect(function (err) {
        if (err) return callback(err);

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
        
      });
    }

    function negotiate(callback) {
      if (!callback) return negotiate.bind(this);
      if (!read) return callback(new Error("Can't negotiate till connected"));
      throw new Error("TODO: Implement tcp negotiate");
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

};

