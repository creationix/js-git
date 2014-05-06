"use strict";
var nodeFs = require("fs");
var nodePath = require("path");
var mkdirp = require("mkdirp");
var FsDb = require("./fs-db");

module.exports = function (repo) {
  FsDb(repo, fs);
};

var fs = {};
fs.readFile = readFile;
fs.readChunk = readChunk;
fs.writeFile = writeFile;
fs.readDir = readDir;

function readFile(path, callback) {
  nodeFs.readFile(path, callback);
}

function readChunk(path, start, end, callback) {
  var stream = nodeFs.createReadStream(path, {
    start: start,
    end: end - 1
  });
  var chunks = [];
  stream.on("readable", function () {
    var chunk = stream.read();
    if (chunk === null) {
      callback(null, join(chunks));
    } else {
      chunks.push(chunk);
    }
  });
  stream.on("error", function (err) {
    callback(err);
  });
}

function writeFile(path, binary, callback) {
  mkdirp(nodePath.dirname(path), function (err) {
    if (err) callback(err);
    nodeFs.writeFile(path, binary, callback);
  });
}

function readDir(path, callback) {
  nodeFs.readdir(path, callback);
}

function join(buffers) {
  var length = 0;
  var at;
  var index;
  var count = buffers.length;
  var buffer;
  var result;
  for (index = 0; index < count; index++) {
    buffer = buffers[index];
    length += buffer.length;
  }
  result = new Buffer(length);
  at = 0;
  for (index = 0; index < count; index++) {
    buffer = buffers[index];
    buffer.copy(result, at, 0);
    at += buffer.length;
  }
  return result;
}

