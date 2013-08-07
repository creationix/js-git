var tcpTransport = require('./tcp-transport.js');
var fetchMachine = require('./machines/fetch.js');
var extract = require('./extract.js');

module.exports = function (platform) {

  var tcp = extract(platform, "tcp");
  var urlParse = extract(platform, "urlParse");

  return fetch;
  function fetch(repo, url, callback) {
    if (!callback) return fetch.bind(this, repo, url);
    url = urlParse(url);
    url.port = url.port ? parseInt(url.port, 10) : 9418;
    if (url.protocol !== 'git:') throw new TypeError("Only supports git:// urls for now");
    var machine = fetchMachine(repo, url.pathname, url.hostname);
    tcp.connect(url.port, url.hostname, function (err, socket) {
      if (err) return callback(err);
      tcpTransport(socket, machine, callback);
    });
  }
}
