var bops =  require('bops');

module.exports = function frame(type, body) {
  return bops.join([
    bops.from(type + " " + body.length + "\0"),
    body
  ]);
};
