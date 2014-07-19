"use strict";

var makeChannel = require('culvert');
var wrapHandler = require('../lib/wrap-handler');
var tcp = window.chrome.sockets.tcp;
var runtime = window.chrome.runtime;

module.exports = connect;

function connect(host, port, onError) {
  port = port|0;
  host = String(host);
  if (!port || !host) throw new TypeError("host and port are required");

  onCreate = wrap(onCreate, onError);
  onConnect = wrap(onConnect, onError);
  onInfo = wrap(onInfo, onError);
  onReceive = wrap(onReceive, onError);
  onReceiveError = wrap(onReceiveError, onError);
  onData = wrapHandler(onData, onError);
  onWrite = wrap(onWrite, onError);

  var paused = false;
  var open = false;
  var socketId;

  var serverChannel = makeChannel();
  var clientChannel = makeChannel();
  var socket = {
    put: serverChannel.put,
    drain: serverChannel.drain,
    take: clientChannel.take
  };

  tcp.onReceive.addListener(onReceive);
  tcp.onReceiveError.addListener(onReceiveError);
  tcp.create(onCreate);

  return {
    put: clientChannel.put,
    drain: clientChannel.drain,
    take: serverChannel.take
  };

  function onCreate(createInfo) {
    socketId = createInfo.socketId;
    tcp.connect(socketId, host, port, onConnect);
  }

  function onConnect(result) {
    if (result < 0) throw new Error(runtime.lastError.message + " Connection error");
    tcp.getInfo(socketId, onInfo);
  }

  function onInfo(socketInfo) {
    if (!socketInfo.connected) {
      throw new Error("Connection failed");
    }
    open = true;
    socket.take(onData);
  }

  function onReceive(info) {
    if (info.socketId !== socketId) return;
    if (socket.put(new Uint8Array(info.data)) || paused) return;
    paused = true;
    tcp.setPaused(socketId, true);
    socket.drain(onDrain);
  }

  function onDrain() {
    if (!paused) return;
    paused = false;
    if (open) tcp.setPaused(socketId, false);
  }

  function onReceiveError(info) {
    if (info.socketId !== socketId) return;
    open = false;
    tcp.close(socketId);
    socket.put();
    // TODO: find a way to tell close and error apart.
    // throw new Error("Code " + info.resultCode + " error while receiving.");
  }

  function onData(data) {
    tcp.send(socketId, data.buffer, onWrite);
  }

  function onWrite(info) {
    if (info.resultCode < 0) {
      throw new Error(runtime.lastError.message + " Error writing.");
    }
    socket.take(onData);
  }
}


function wrap(fn, onError) {
  return function () {
    try {
      return fn.apply(this, arguments);
    }
    catch (err) {
      onError(err);
    }
  };
}
