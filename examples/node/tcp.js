var net = require('net');
var wrapStream = require('./stream.js').wrapStream;

module.exports = {
  createServer: createServer,
  connect: connect
};

function createServer(port, address, onConnection) {
  if (typeof address === "function" && typeof onConnection === "undefined") {
    onConnection = address;
    address = "127.0.0.1";
  }
  if (typeof port !== "number") throw new TypeError("port must be number");
  if (typeof address !== "string") throw new TypeError("address must be string");
  if (typeof onConnection !== "function") throw new TypeError("onConnection must be function");

  var server = net.createServer();
  server.listen(port, address);
  server.on("connection", function (stream) {
    onConnection(wrapStream(stream));
  });
  return server;
}

function connect(port, address, callback) {
  if (typeof address === "function" && typeof callback === "undefined") {
    callback = address;
    address = "127.0.0.1";
  }
  if (!callback) return connect.bind(this, port, address);
  if (typeof port !== "number") throw new TypeError("port must be number");
  if (typeof address !== "string") throw new TypeError("address must be string");
  if (typeof callback !== "function") throw new TypeError("callback must be function");

  var stream = net.connect(port, address);

  stream.on("error", finish);
  stream.on("connect", onConnect);

  var done = false;
  function finish(err, socket) {
    if (done) return;
    done = true;
    stream.removeListener("error", finish);
    stream.removeListener("connect", onConnect);
    callback(err, socket);
  }

  function onConnect() {
    finish(null, wrapStream(stream));
  }

  return stream;
}

