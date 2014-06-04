function oneCall(fn) {
  var done = false;
  return function () {
    if (done) return;
    done = true;
    return fn.apply(this, arguments);
  };
}

module.exports = findCommon;

function findCommon(repo, a, b, callback) {
  callback = oneCall(callback);
  var ahead = 0, behind = 0;
  var aStream, bStream;
  var aCommit, bCommit;

  if (a === b) return callback(null, ahead, behind);
  repo.logWalk(a, onAStream);
  repo.logWalk(b, onBStream);

  function onAStream(err, stream) {
    if (err) return callback(err);
    aStream = stream;
    aStream.read(onA);
  }

  function onBStream(err, stream) {
    if (err) return callback(err);
    bStream = stream;
    bStream.read(onB);
  }

  function onA(err, commit) {
    if (!commit) return callback(err || new Error("No common commit"));
    aCommit = commit;
    if (bCommit) compare();
  }

  function onB(err, commit) {
    if (!commit) return callback(err || new Error("No common commit"));
    bCommit = commit;
    if (aCommit) compare();
  }

  function compare() {
    if (aCommit.hash === bCommit.hash) return callback(null, ahead, behind);
    if (aCommit.author.date.seconds > bCommit.author.date.seconds) {
      ahead++;
      aStream.read(onA);
    }
    else {
      behind++;
      bStream.read(onB);
    }
  }

}
