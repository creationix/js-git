var binary =  require('bodec');

module.exports = function frame(type, body) {
  return binary.join([
    binary.fromRaw(type + " " + body.length + "\0"),
    body
  ]);
};
