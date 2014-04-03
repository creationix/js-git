var run = require('./run.js');

// The thing we mean to test.
var codec = require('../lib/config-codec.js');

var sample = '\
[user]\n\
\tname = Tim Caswell\n\
\temail = tim@creationix.com\n\
[core]\n\
\teditor = vim\n\
\twhitespace = fix,-indent-with-non-tab,trailing-space,cr-at-eol\n\
[web]\n\
\tbrowser = google-chrome\n\
[color]\n\
\tui = true\n\
[color "branch"]\n\
\tcurrent = yellow bold\n\
\tlocal = green bold\n\
\tremote = cyan bold\n\
[color "diff"]\n\
\tmeta = yellow bold\n\
\tfrag = magenta bold\n\
\told = red bold\n\
\tnew = green bold\n\
\twhitespace = red reverse\n\
[github]\n\
\tuser = creationix\n\
\ttoken = token';

var config;

run([
  function testDecode() {
    config = codec.decode(sample);
    if (config.user.name !== "Tim Caswell") {
      throw new Error("Failed to parse user.name");
    }
    if (config.color.ui != "true") {
      throw new Error("Failed to parse color.ui");
    }
    if (config.color.diff.meta !== "yellow bold") {
      throw new Error("Failed to parse color.diff.meta");
    }
  },
  function testEncode() {
    var encoded = codec.encode(config);
    var config2 = codec.decode(encoded);
    if (JSON.stringify(config) !== JSON.stringify(config2)) {
      console.log(config);
      console.log(encoded);
      console.log(config2);
      throw new Error("Encode failed");
    }
  },
  function testEncode2() {
    var encoded = codec.encode({
      foo: {
        bar: {
          baz: true
        }
      }
    });
    if (encoded !== '[foo "bar"]\n\tbaz = true\n') {
      console.log(encoded);
      throw new Error("Invalid encoding of single deep config");
    }
  }
]);
