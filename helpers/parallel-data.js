module.exports = parallelData;

// Run many actions in parallel and preserve the results
function parallelData(actions, callback) {
  if (!callback) return parallelData.bind(this, actions);
  var results = {};
  var names = Object.keys(actions);
  var left = names.length;
  var done = false;

  function finish(err) {
    if (done) return;
    done = true;
    callback(err, results);
  }

  names.forEach(function (name) {
    actions[name](function (err, result) {
      results[name] = result;
      if (err) return finish(err);
      if (!--left) finish();
    });
  });
}
