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
      socket.sink(framer(write));

      write("git-upload-pack " + url.pathname + "\0host=" + url.hostname + "\0");

      line.read(onRead);

      function onRead(err, item) {
        if (err) return callback(err);
        console.log(item);
        if (item !== undefined) line.read(onRead);
      }
    });
  }
};
