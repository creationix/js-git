"use strict";

var makeChannel = require('culvert');
var bodec = require('bodec');
var pktLine = require('../lib/pkt-line');
var wrapHandler = require('../lib/wrap-handler');

module.exports = function (connect) {

  return function tcpTransport(path, host, port) {
    port = (port|0) || 9418;
    if (!path || !host) throw new Error("path and host are required");

    return function (serviceName, onError) {

      onData = wrapHandler(onData, onError);
      onDrain = wrapHandler(onDrain, onError);

      var socket = connect(host, port, onError);
      var inter = makeChannel();
      inter.put = pktLine.deframer(inter.put);

      socket.put = pktLine.framer(socket.put);
      var greeting = bodec.fromRaw(serviceName + " " + path + "\0host=" + host + "\0");
      socket.put(greeting);

      // Pipe socket to inter with backpressure
      socket.take(onData);
      function onData(chunk) {
        if (inter.put(chunk)) {
          socket.take(onData);
        }
        else {
          inter.drain(onDrain);
        }
      }
      function onDrain() {
        socket.take(onData);
      }

      return {
        put: socket.put,
        drain: socket.drain,
        take: inter.take
      };
    };
  };
};
