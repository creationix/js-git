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
  var n = 0;
  console.log("TCP Echo Server Listening at localhost 3000");
  helpers.consume(server.source, function (err, client) {
    if (err) throw err;
    console.log("New client", client);
    client.sink(client.source);
  });
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

function bufferToString(buffer, callback) {
  var reader = new FileReader();
  reader.onload = function (evt) {
    callback(evt.target.result);
  };
  reader.readAsText(new Blob([new Uint8Array(buffer)]));
}

