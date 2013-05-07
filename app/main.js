"use strict";

require('git-fs-html5')(function (err, fs) {
  if (err) throw err;
  window.fs = fs;
  require('git-db-fs')(fs, "/.gitdb", function (err, db) {
    if (err) throw err;
    window.db = db;
  });
});

console.log(
  "Welcome to the js-git demo.\n" +
  "There are some global objects you can use to manipulate the sandbox.\n" +
  "They are `fs`, `git`, and `db`.\n" +
  "Use auto-complete to explore their capabilities"
);

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');

tcp.createServer("0.0.0.0", 3000, function (err, server) {
  if (err) throw err;
  console.log("TCP Echo Server Listening at localhost 3000");
  helpers.sink(onConnection)(server.source);
});

function onConnection(err, client) {
  helpers.sink(onData)(client.source);
  function onData(err, chunk) {
    if (err) throw err;
    console.log(JSON.stringify(bufferToString(chunk)));
  }
}

function bufferToString(buffer) {
  if (buffer instanceof ArrayBuffer) {
    buffer = new Uint8Array(buffer);
  }
  var string = "";
  for (var i = 0, l = buffer.length; i < l; i++) {
    string += String.fromCharCode(buffer[i]);
  }
  return decodeURIComponent(escape(string));
}

var tcpApp = helpers.pushToPull(function (emit) {
  console.log("New client");
  return function (err, chunk) {
    console.log("event", err, chunk);
    if (chunk === undefined) return emit(err);
  };
});

window.httpGet = function (host) {
  window.helpers = helpers;
  tcp.connect(host, 80, function (err, socket) {
    if (err) throw err;
    var pipe = helpers.makePipe();
    socket.sink(pipe.read);
    helpers.consume(socket.source, function (err, item) {
      if (err) throw err;
      bufferToString(item, console.log.bind(console));
    });
    pipe.emit(null, "GET / HTTP/1.1\r\nHost: " + host + "\r\n\r\n");
  });
}


