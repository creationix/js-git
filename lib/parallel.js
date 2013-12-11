module.exports = parallel;

// Run several continuables in parallel.  The results are stored in the same
// shape as the input continuables (array or object).
// Returns a new continuable or accepts a callback.
// This will bail on the first error and ignore all others after it.
function parallel(commands, callback) {
  if (!callback) return parallel.bind(this, commands);
  var results, length, left, i, done;
  
  // Handle array shapes
  if (Array.isArray(commands)) {
    length = commands.length;
    left = results = new Array(left);
    for (i = 0; i < length; i++) {
      run(i, commands[i]);
    }
  }
  
  // Otherwise assume it's an object.
  else {
    var keys = Object.keys(commands);
    left = length = keys.length;
    results = {};
    for (i = 0; i < length; i++) {
      var key = keys[i];
      run(key, commands[key]);
    }
  }
  
  // Common logic for both
  function run(key, command) {
    command(function (err, result) {
      if (done) return;
      if (err) {
        done = true;
        return callback(err);
      }
      results[key] = result;
      if (--left) return;
      done = true;
      callback(null, results);
    });
  }
}