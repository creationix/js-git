"use strict";

// This is for working with git config files like .git/config and .gitmodules.
// I believe this is just INI format.
module.exports = {
  encode: encode,
  decode: decode
};

function encode(config) {
  return Object.keys(config).map(function (name) {
    var obj = config[name];
    for (var key in obj) {
      if (typeof obj[key] !== "object") {
        return '[' + name + ']\n' + encodeBody(obj);
      }
      return Object.keys(obj).map(mapSub).join("\n");
    }
    return "";

    function mapSub(sub) {
      return '[' + name + ' "' + sub + '"]\n' + encodeBody(obj[sub]);
    }
  }).join("\n") + "\n";
}

function encodeBody(obj) {
  return Object.keys(obj).map(function (name) {
    return "\t" + name + " = " + obj[name];
  }).join("\n");
}

function decode(text) {
  var config = {};
  var section;
  text.split(/[\r\n]+/).forEach(function (line) {
    var match = line.match(/\[([^ \t"\]]+) *(?:"([^"]+)")?\]/);
    if (match) {
      section = config[match[1]] || (config[match[1]] = {});
      if (match[2]) {
        section = section[match[2]] = {};
      }
      return;
    }
    match = line.match(/([^ \t=]+)[ \t]*=[ \t]*([^ \t]+)/);
    if (match) {
      section[match[1]] = match[2];
    }
  });
  return config;
}
