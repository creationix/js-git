var platform = require('../lib/platform.js');
var http = platform.require("http");
var agent = platform.require("agent");
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('../lib/pkt-line.js').deframer);
var trace = platform.require('trace');
var sharedDiscover = require('./discover.js');
var each = require('../helpers/each.js');
var pktLine = require('../lib/pkt-line.js');
var bops = require('bops');

// opts.hostname - host to connect to (github.com)
// opts.pathname - path to repo (/creationix/conquest.git)
// opts.tls - true or false (https vs http, defaults to false)
// opts.port - override default port (80 for http, 443 for https)
module.exports = function (opts) {
  opts.tls = !!opts.tls;
  opts.port = opts.port ? opts.port | 0 : (opts.tls ? 443 : 80);
  if (!opts.hostname) throw new TypeError("hostname is a required option");
  if (!opts.pathname) throw new TypeError("pathname is a required option");

  return {
    discover: discover,
    fetch: fetch,
    close: close
  };

  function addDefaults(extras) {
    var headers = {
      "User-Agent": agent,
      "Host": opts.hostname,
    };
    for (var key in extras) {
      headers[key] = extras[key];
    }
    return headers;
  }

  function get(path, headers, callback) {
    http.request({
      method: "GET",
      hostname: opts.hostname,
      tls: opts.tls,
      port: opts.port,
      auth: opts.auth,
      path: opts.pathname + path,
      headers: addDefaults(headers)
    }, callback);
  }

  function post(path, headers, body, callback) {
    headers = addDefaults(headers);
    if (typeof body === "string") {
      body = bops.from(body);
    }
    if (bops.is(body)) {
      headers["Content-Length"] = body.length
    }
    http.request({
      method: "POST",
      hostname: opts.hostname,
      tls: opts.tls,
      port: opts.port,
      auth: opts.auth,
      path: opts.pathname + path,
      headers: headers,
      body: body
    }, callback);
  }

  // Send initial git-upload-pack request
  // outputs refs and caps
  function discover(callback) {
    if (!callback) return discover.bind(this);
    get("/info/refs?service=git-upload-pack", {
      "Accept": "*/*",
      "Accept-Encoding": "gzip",
      "Pragma": "no-cache"
    }, function (err, code, headers, body) {
      if (err) return callback(err);
      if (code !== 200) return callback(new Error("Unexpected status code " + code));
      if (headers['content-type'] !== 'application/x-git-upload-pack-advertisement') {
        return callback(new Error("Wrong content-type in server response"));
      }

      body = deframer(body);
      if (trace) body = trace("input", body);

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
          sharedDiscover(body, callback);
        });
      });
    });
  }

  function fetch(opts, callback) {
    var want = opts.want,
        have = opts.have,
        onProgress = opts.onProgress,
        onError = opts.onError;

    if (!callback) return fetch.bind(this, opts);
    discover(function (err, refs, serverCaps) {
      if (err) return callback(err);

      var caps = [];
      if (serverCaps["ofs-delta"]) caps.push("ofs-delta");
      if (serverCaps["thin-pack"]) caps.push("thin-pack");
      if (opts.includeTag && serverCaps["include-tag"]) caps.push("include-tag");
      if ((opts.onProgress || opts.onError) &&
          (serverCaps["side-band-64k"] || serverCaps["side-band"])) {
        caps.push(serverCaps["side-band-64k"] ? "side-band-64k" : "side-band");
        if (!opts.onProgress && serverCaps["no-progress"]) {
          caps.push("no-progress");
        }
      }
      if (serverCaps.agent) caps.push("agent=" + agent);

      if (want) throw new Error("TODO: Implement dynamic wants");
      if (have) throw new Error("TODO: Implement dynamic have");

      var wants = [];
      each(refs, function (name, hash) {
        if (name === "HEAD" || name.indexOf('^') > 0) return;
        wants.push("want " + hash);
      });

      wants[0] += " " + caps.join(" ");
      wants.push(null, "done\n");

      var body = [];
      wants.forEach(function (line) {
        if (line === null) {
          return body.push(bops.from("0000"));
        }
        line = bops.from(line);
        body.push(pktLine.frameHead(line), line);
      });
      body = bops.join(body);

      post("/git-upload-pack", {
        "Content-Type": "application/x-git-upload-pack-request",
        "Accept": "application/x-git-upload-pack-result",
      }, body, function (err, code, headers, body) {
        if (err) return callback(err);
        // console.log({code:code,headers:headers,body:body});
      })

//   var packStream = writable(abort);

//   read(function (err, nak) {
//     if (err) return callback(err);
//     if (nak.trim() !== "NAK") {
//       return callback(Error("Expected NAK"));
//     }
//     callback(null, {
//       read: packStream.read,
//       abort: packStream.abort,
//       refs: refs
//     });
//     read(onItem);
//   });

//   function onItem(err, item) {
//     if (err) return packStream.error(err);
//     if (item) {
//       if (item.progress) {
//         if (opts.onProgress) opts.onProgress("remote: " + item.progress);
//       }
//       else if (item.error) {
//         if (opts.onError) opts.onError(item.error);
//       }
//       else {
//         packStream(item);
//       }
//     }
//     if (item === undefined) {
//       packStream(undefined);
//     }
//     else read(onItem);
//   }

// }



    });
  }

  function close(callback) {
    if (!callback) return close.bind(this);
    callback();
  }

}
