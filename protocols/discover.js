module.exports = discover;
function discover(socket, callback) {
  var read = socket.read,
      write = socket.write,
      abort = socket.abort;

  var refs = {};
  var caps = null;

  read(onLine);

  function onLine(err, line) {
    if (err) return callback(err);
    if (line === null) {
      return callback(null, refs, caps);
    }
    line = line.trim();
    if (!caps) line = pullCaps(line);
    var index = line.indexOf(" ");
    refs[line.substr(index + 1)] = line.substr(0, index);
    read(onLine);
  }

  function pullCaps(line) {
    var index = line.indexOf("\0");
    caps = {};
    line.substr(index + 1).split(" ").map(function (cap) {
      var pair = cap.split("=");
      caps[pair[0]] = pair[1] || true;
    });
    return line.substr(0, index);
  }
}
