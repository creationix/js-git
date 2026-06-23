// -*- mode: js; js-indent-level: 2; -*-
"use strict";

var makeChannel = require('culvert');
var wrapHandler = require('../lib/wrap-handler');
var bodec = require('bodec');

module.exports = sendPack;

function sendPack(transport, onError) {

  if (!onError) onError = throwIt;

  // Wrap our handler functions to route errors properly.
  onRef = wrapHandler(onRef, onError);
  onPush = wrapHandler(onPush, onError);

  var caps = null;
  var capsSent = false;
  var refs = {};
  var haves = {};
  var havesCount = 0;

  // Create a duplex channel for talking with the agent.
  var libraryChannel = makeChannel();
  var agentChannel = makeChannel();
  var api = {
    put: libraryChannel.put,
    drain: libraryChannel.drain,
    take: agentChannel.take
  };

  // Start the connection and listen for the response.
  var socket = transport("git-receive-pack", onError);
  socket.take(onRef);

  // Return the other half of the duplex API channel.
  return {
    put: agentChannel.put,
    drain: agentChannel.drain,
    take: libraryChannel.take
  };

  function onRef(line) {
    if (line === undefined) {
      throw new Error("Socket disconnected");
    }
    if (line === null) {
      api.put(refs);
      api.take(onPush);
      return;
    } else if (!caps) {
      caps = {};
      Object.defineProperty(refs, "caps", {
        value: caps
      });
      var index = line.indexOf("\0");
      if (index >= 0) {
        line.substring(index + 1).split(" ").forEach(function (cap) {
          var i = cap.indexOf("=");
          if (i >= 0) {
            caps[cap.substring(0, i)] = cap.substring(i + 1);
          } else {
            caps[cap] = true;
          }
        });
        line = line.substring(0, index);
      }
    }
    var match = line.match(/(^[0-9a-f]{40}) (.*)$/);
    if (!match) {
      if (typeof line === "string" && /^ERR/i.test(line)) {
        throw new Error(line);
      }
      throw new Error("Invalid line: " + JSON.stringify(line));
    }
    refs[match[2]] = match[1];
    socket.take(onRef);
  }

  var packChannel;
  var progressChannel;
  var errorChannel;

  function onPush(line) {
    if (line === undefined) return socket.put();
    if (line === null) {
      socket.put(null);
      return api.take(onPack);
    }
    if (line.oldhash) {
      var extra = "";
      if (!capsSent) {
        capsSent = true;
        var caplist = [];
        if (caps["ofs-delta"]) caplist.push("ofs-delta");
        if (caps["thin-pack"]) caplist.push("thin-pack");
        // if (caps["multi_ack_detailed"]) extra += " multi_ack_detailed";
        // else if (caps["multi_ack"]) extra +=" multi_ack";
        if (caps["side-band-64k"]) caplist.push("side-band-64k");
        else if (caps["side-band"]) caplist.push("side-band");
        // if (caps["agent"]) extra += " agent=" + agent;
        if (caps.agent) extra += caplist.push("agent=" + caps.agent);
        extra = "\0" + caplist.join(" ");
      }
      extra += "\n";
      socket.put(line.oldhash + " " + line.newhash + " " + line.ref + extra);
      return api.take(onPush);
    }
    throw new Error("Invalid push command");
  }

  function onPack(_, line) {
    if (line.flush) {
      socket.put(line);
      var fwd = function(_, b) {
	api.put(b);
	socket.take(fwd);
      }
      socket.take(fwd);
    } else {
      socket.put({
        noframe: line
      });
    }
    return api.take(onPack);
  }

  function onResponse(h) {
    callback(h);
  }

}

var defer = require('js-git/lib/defer');

function throwIt(err) {
  defer(function () {
    throw err;
  });
  // throw err;
}
