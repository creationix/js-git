var extract = require('./extract.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('./pkt-line.js').deframer);
var framer = pushToPull(require('./pkt-line.js').framer);
var demux = require('./demux.js');
var writable = require('./writable.js');

module.exports = function (platform) {

  var tcp = extract(platform, "tcp");
  var urlParse = extract(platform, "urlParse");

  return lsRemote;
  function lsRemote(url, callback) {
    if (!callback) return lsRemote.bind(this, url);
    url = urlParse(url);
    url.port = url.port ? parseInt(url.port, 10) : 9418;
    if (url.protocol !== 'git:') throw new TypeError("Only supports git:// urls for now");
    tcp.connect(url.port, url.hostname, function (err, socket) {
      if (err) return callback(err);
      var line = demux(deframer(socket), ["line"]).line;
      var write = writable(socket.abort);
      socket.sink(framer(write), finish);

      write("git-upload-pack " + url.pathname + "\0host=" + url.hostname + "\0");

      line.read(onRead);

      var refs = {};
      var caps = null;

      function onRead(err, item) {
        if (err) return callback(err);
        if (item) {
          if (!caps) {
            var index = item.indexOf("\0");
            caps = {};
            item.substr(index + 1).trim().split(" ").map(function (cap) {
              var pair = cap.split("=");
              caps[pair[0]] = pair[1] || true;
            });
            item = item.substr(0, index);
          }
          var pair = item.trim().split(" ");
          refs[pair[0]] = pair[1];
        }
        else if (item === null) {
          write(null);
        }
        else {
          write();
          finish();
        }
        line.read(onRead)
      }

      var done = false;
      function finish(err) {
        if (done) return;
        done = true;
        callback(err, refs, caps);
      }
    });
  }
};
