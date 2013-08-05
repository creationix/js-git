var refsMachine = require('./refs.js');

module.exports = lsRemoteMachine;
function lsRemoteMachine(path, host, write, emit) {
  write("git-upload-pack " + path + "\0host=" + host + "\0");
  return refsMachine(write, function (refs) {
    write(null);
    emit(refs);
  });
}
