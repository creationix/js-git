var extract = require('../helpers/extract.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var framer = pushToPull(require('../lib/pkt-line.js').framer);

module.exports = smartHttp;
function smartHttp(platform) {
  var http = extract(platform, "http");
  var agent = extract(platform, "agent");

  return connect;

  // opts.hostname - host to connect to (github.com)
  // opts.pathname - path to repo (/creationix/conquest.git)
  // opts.tls - true or false (https vs http, defaults to false)
  // opts.port - override default port (80 for http, 443 for https)
  function connect(opts) {
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
      var refs = {};
      var caps = null;

      http.request({
        trace: opts.trace,
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

        var body = deframer(body);
        if (opts.trace) body = opts.trace("input", body);

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
            body.read(onLine);
          });
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
          body.read(onLine);
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
      throw new Error("TODO: Implement smart-http negotiate");
    }

    function close(callback) {
      if (!callback) return close.bind(this);
      callback();
    }

  }

};
