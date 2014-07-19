var pako = require('pako');
var Binary = require('bodec').Binary;
if (Binary === Uint8Array) {
  module.exports = pako.deflate;
}
else {
  module.exports = function deflate(value) {
    return new Binary(pako.deflate(new Uint8Array(value)));
  };
}
