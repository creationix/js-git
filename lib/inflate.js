var pako = require('pako');
var Binary = require('bodec').Binary;
if (Binary === Uint8Array) {
  module.exports = pako.inflate;
}
else {
  module.exports = function inflate(value) {
    return new Binary(pako.inflate(new Uint8Array(value)));
  };
}
