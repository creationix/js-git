var binary = require('bodec');
var indexOf = require('./indexof.js');
var parseDec = require('./parsedec.js');
var parseAscii = require('./parseascii.js');

module.exports = function deframe(buffer) {
  var space = indexOf(buffer, 0x20);
  if (space < 0) throw new Error("Invalid git object buffer");
  var nil = indexOf(buffer, 0x00, space);
  if (nil < 0) throw new Error("Invalid git object buffer");
  var body = binary.slice(buffer, nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error("Invalid body length.");
  return [
    parseAscii(buffer, 0, space),
    body
  ];
};
