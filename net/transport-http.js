"use strict";

var makeChannel = require('culvert');
var bodec = require('bodec');
var pktLine = require('../lib/pkt-line');
var wrapHandler = require('../lib/wrap-handler');

module.exports = function (request) {

  return function httpTransport(gitUrl, username, password) {
    // Send Auth header if username is set
    var auth;
    if (username) {
      auth = "Basic " + btoa(username + ":" + (password || ""));
    }

    return function (serviceName, onError) {

      // Wrap our handler functions to route errors properly.
      onResponse = wrapHandler(onResponse, onError);
      onWrite = wrapHandler(onWrite, onError);
      onResult = wrapHandler(onResult, onError);

      // Create a duplex channel with transform for internal use.
      var serverChannel = makeChannel();//0, "server");
      var clientChannel = makeChannel();//0, "client");
      var socket = {
        put: serverChannel.put,
        drain: serverChannel.drain,
        take: clientChannel.take
      };

      // Send the initial request to start the connection.
      var headers = {};
      if (auth) headers.Authorization = auth;
      request("GET", gitUrl + "/info/refs?service=" + serviceName, headers, onResponse);

      // Prep for later requests
      var bodyParts = [];
      var bodyWrite = pktLine.framer(function (chunk) {
        bodyParts.push(chunk);
      });
      headers["Content-Type"] = "application/x-" + serviceName + "-request";
      socket.take(onWrite);

      var verified = 0;
      var parseResponse = pktLine.deframer(function (line) {
        if (verified === 2) {
          socket.put(line);
        }
        else if (verified === 0) {
          if (line !== "# service=" + serviceName) {
            throw new Error("Illegal service response");
          }
          verified = 1;
        }
        else if (verified === 1) {
          if (line !== null) {
            throw new Error("Expected null after service name");
          }
          verified = 2;
        }
      });

      // Return the other half of the duplex channel for the protocol logic to use.
      return {
        put: clientChannel.put,
        drain: clientChannel.drain,
        take: serverChannel.take
      };

      function onResponse(res) {
        if (res.statusCode !== 200) {
          throw new Error("Invalid response: " + res.statusCode);
        }
        if (res.headers["content-type"] !== "application/x-" + serviceName + "-advertisement") {
          throw new Error("Not a smart http git server");
        }
        parseResponse(res.body);
      }

      function onWrite(item) {
        if (item === undefined) return socket.put();
        bodyWrite(item);
        socket.take(onWrite);
        if (item !== "done\n" || !bodyParts.length) return;
        var body = bodec.join(bodyParts);
        bodyParts.length = 0;
        request("POST", gitUrl + "/" + serviceName, headers, body, onResult);
      }

      function onResult(res) {
        if (res.statusCode !== 200) {
          throw new Error("Invalid result: " + res.statusCode);
        }
        if (res.headers["content-type"] !== "application/x-" + serviceName + "-result") {
          throw new Error("Not a smart http git server");
        }
        parseResponse(res.body);
      }
    };
  };
};
