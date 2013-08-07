module.exports = {
  fs: require('./fs.js'),
  tcp: require('./tcp.js'),
  sha1: require('./sha1.js'),
  inflate: require('./inflate.js'),
  deflate: require('./deflate.js'),
  urlParse: require('./url-parse.js'),
  version: "jsgit/" + require('../../package.json').version
};
