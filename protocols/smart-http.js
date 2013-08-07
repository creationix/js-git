var extract = require('../helpers/extract.js');

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
    opts.port = opts.port ? opts.port | 0 : (opts.tls ? 442 : 80);
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
      http.request({
        method: "GET",
        hostname: opts.hostname,
        tls: opts.tls,
        port: opts.port,
        path: opts.pathname + "/info/refs?service=git-upload-pack",
        headers: headers
      }, function (err, code, headers, body) {
        if (err) return callback(err);
        console.log({
          code: code,
          headers: headers,
          body: body
        });
        throw new Error("TODO: Finish smart-http discover");
      });
    }

    function negotiate(callback) {
      if (!callback) return negotiate.bind(this);
      throw new Error("TODO: Implement smart-http negotiate");
    }

    function close(callback) {
      if (!callback) return close.bind(this);
      throw new Error("TODO: Implement smart-http close");
    }

  }

};
