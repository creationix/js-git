#!/usr/bin/env node

var argv = require('optimist')
  .usage("Create a logging tcp proxy")
  .options("remotehost", {
    default: "localhost"
  })
  .options("remoteport", {
    default: 9418
  })
  .options("localhost", {
    default: "localhost"
  })
  .options("localport", {
    default: 3000
  })
  .demand("logfile")
  .argv;


var tcp = require('min-stream-node/tcp.js');
var fs = require('min-stream-node/fs.js');
var msgpack = require('msgpack-js');
var helpers = require('min-stream-helpers');

if (argv.logfile.indexOf(".") < 0) {
  argv.logfile += ".msgpack";
}

tcp.createServer(argv.localhost, argv.localport, function (err, server) {
  if (err) {
    console.error(err.stack);
    return;
  }
  console.log("Local TCP proxy listening at %s:%s", argv.localhost, argv.localport);
  console.log(" - forwards to %s:%s", argv.remotehost, argv.remoteport);
  console.log(" - logs conversation with timing as %s", argv.logfile);
  helpers.sink(onConnection)(server.source);
});

function onConnection(err, local) {
  if (err) {
    console.error(err.stack);
    return;
  }
  console.log("New local client");
  tcp.connect(argv.remotehost, argv.remoteport, function (err, remote) {
    if (err) {
      console.error(err.stack);
      return;
    }
    console.log("Connected");
    remote.sink(local.source);
    local.sink(remote.source);
  });
}


function splitter(read) {
  var readers = [];
  var readQueues = [];
  var event = null;
  var reading = false;
  
  function onRead() {
    reading = false;
    event = arguments;
    check();
  }
  
  function check() {
    if (event) {
      for (var i = 0, l = readers.length; i < l; i++) {
        var queue = readQueues[i];
        if (!(queue && queue.length)) return;
      }
      var data = event;
      event = null;
      var callbacks = readQueues.map(function (queue) {
        return queue.shift();
      });
      callbacks.forEach(function (callback) {
        callback.apply(null, data);
      });
    }
    if (!event) {
      reading = true;
      read(onRead);
    }
  }
  
  return function () {
    var fn = function (close, callback) {
      if (close) {
        throw new Error("TODO: Implement close");
        // TODO: Implement
        // Remove this reader from the readers list
        // remove it's readQueue
        // If it was the last, close upstream
      }
      var index = readers.indexOf(fn);
      readQueues[index].push(callback);
      check();
    };
    readers.push(fn);
    readQueues.push([]);
  };
}



