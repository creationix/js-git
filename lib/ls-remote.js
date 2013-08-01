var extract = require('./extract.js');

module.exports = function (platform) {

  var tcp = extract(platform, "tcp");

  return lsRemote;
  function lsRemote(url, callback) {
    if (!callback) return lsRemote.bind(this, url);
    throw new Error("TODO: Implement lsRemote");
  }
};
