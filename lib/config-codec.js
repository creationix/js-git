"use strict";

module.exports = {
  encode: encode,
  parse: parse
};

function encode(config) {
  var lines = [];
  Object.keys(config).forEach(function (type) {
    var obj = config[type];
    Object.keys(obj).forEach(function (name) {
      var item = obj[name];
      lines.push('[' + type + ' "' + name + '"]');
      Object.keys(item).forEach(function (key) {
        var value = item[key];
        lines.push("\t" + key + " = " + value);
      });
      lines.push("");
    });
  });
  return lines.join("\n");
}

function parse(text) {
  var config = {};
  var match, offset = 0;
  while ((match = text.substr(offset).match(/\[([a-z]*) "([^"]*)"\]([^\[]*)/))) {
    var type = match[1];
    var section = config[type] || (config[type] = {});
    var name = match[2];
    section[name] = parseBody(match[3]);
    offset += match[0].length;
  }
  return config;
}

function parseBody(text) {
  var entry = {};
  var match, offset = 0;
  while ((match = text.substr(offset).match(/([^ \t\r\n]*) *= *([^ \t\r\n]*)/))) {
    entry[match[1]] = match[2];
    offset += match[0].length;
  }
  return entry;
}
