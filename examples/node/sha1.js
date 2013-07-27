var crypto = require('crypto');

module.exports = sha1;
function sha1(buffer) {
  var shasum = crypto.createHash('sha1');
  shasum.update(buffer);
  return shasum.digest('hex');
}

