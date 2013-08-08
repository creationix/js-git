var crypto = require('crypto');

module.exports = function (buffer) {
  if (buffer === undefined) return create();
  var shasum = crypto.createHash('sha1');
  shasum.update(buffer);
  return shasum.digest('hex');
}

// A streaming interface for when nothing is passed in.
function create() {
  var sha1sum = crypto.createHash('sha1');
  return { update: update, digest: digest };

  function update(data) {
    sha1sum.update(data);
  }

  function digest() {
    return sha1sum.digest('hex');
  }
}

