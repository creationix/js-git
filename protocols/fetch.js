var platform = require('../lib/platform.js');
var writable = require('../helpers/writable.js');
var agent = platform.require('agent');
var each = require('../helpers/each.js');

module.exports = fetch;
function fetch(socket, opts, callback) {
  var read = socket.read,
      write = socket.write,
      abort = socket.abort;
  var want = opts.want,
      have = opts.have,
      onProgress = opts.onProgress,
      onError = opts.onError,
      refs = opts.refs,
      serverCaps = opts.caps;

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
      abort: packStream.abort,
      refs: refs
    });
    read(onItem);
  });

  function onItem(err, item) {
    if (err) return packStream.error(err);
    if (item) {
      if (item.progress) {
        if (opts.onProgress) opts.onProgress("remote: " + item.progress);
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
