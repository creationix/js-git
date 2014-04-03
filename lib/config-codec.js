"use strict";

// This is for working with git config files like .git/config and .gitmodules.
// I believe this is just INI format.
module.exports = {
  encode: encode,
  decode: decode
};

function encode(config) {
  var lines = [];
  Object.keys(config).forEach(function (name) {
    var obj = config[name];
    var deep = {};
    var values = {};
    var hasValues = false;
    Object.keys(obj).forEach(function (key) {
      var value = obj[key];
      if (typeof value === 'object') {
        deep[key] = value;
      }
      else {
        hasValues = true;
        values[key] = value;
      }
    });
    if (hasValues) {
      encodeBody('[' + name + ']', values);
    }

    Object.keys(deep).forEach(function (sub) {
      var child = deep[sub];
      encodeBody('[' + name + ' "' + sub + '"]', child);
    });
  });

  return lines.join("\n") + "\n";

  function encodeBody(header, obj) {
    lines.push(header);
    Object.keys(obj).forEach(function (name) {
      lines.push( "\t" + name + " = " + obj[name]);
    });
  }

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
    match = line.match(/([^ \t=]+)[ \t]*=[ \t]*(.+)/);
    if (match) {
      section[match[1]] = match[2];
    }
  });
  return config;
}
