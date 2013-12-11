module.exports = serial;

// Run several continuables in serial.  The results are stored in the same
// shape as the input continuables (array or object).
// Returns a new continuable or accepts a callback.
// This will bail on the first error.
function serial(commands, callback) {
  if (!callback) return serial.bind(this, commands);
  var results, keys, index = 0, length, key;
  
  if (Array.isArray(commands)) {
    length = commands.length;
    results = new Array(length);
  }
  else {
    results = {};
    keys = Object.keys(commands);
    length = keys.length;
  }
  
  index = 0;
  return runNext();
  
  function runNext() {
    if (index >= length) {
      return callback(null, results);
    }
    key = keys ? keys[index] : index;
    var command = commands[key];
    command(onResult);
  }
  
  function onResult(err, result) {
    if (err) return callback(err);
    results[key] = result;
    runNext();
  }
}