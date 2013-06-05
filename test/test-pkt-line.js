"use strict";

var pktLine = require('../src/pkt-line.js');
var bops = require('bops');
var min = require('min-stream');
var test = require('tape');

// Some canned data manually broken up at weird places to test deframing logic
var chunked = [
  '002bgit-upload-pack /js-git',
  '\0host=localhost\0',
  '00ad52bc15b3e685afe74f8331bade5ed992b8ae',
  'edee HEAD\0multi_ack thin-pack side-b',
  'and side-band-64k ofs-delta shallow no-pro',
  'gress include-tag multi_ack_detailed agent=',
  'git/1.8.1.2\n003f52bc15b3e685afe74f8331bade5',
  'ed992b8aeedee refs/heads/master\n004652bc15b3',
  'e685afe74f8331bade5ed992b8aeedee refs/remotes/o',
  'rigin/HEAD\n004852bc15b3e685afe74f8331bade5ed992',
  'b8aeedee refs/remotes/origin/master\n000000040007',
  'hi\n0032want 0000000000000000000000000000000000000',
  '000\n0000001bhi\0ofs-delta hat party\nPACKhelloworld',
  'this is a long binary blob right? Right!'
];

var messages = [
  ["line", "git-upload-pack /js-git\0host=localhost\0"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n"],
  ["line", null],  // pkt-flush events are encoded as null
  ["line", ""],    // So they can be distinguished from empty strings
  ["line", "hi\n"],
  ["line", "want 0000000000000000000000000000000000000000\n"],
  ["line", null],
  ["line", "hi\0ofs-delta hat party\n"],
  ["pack", bops.from("PACKhelloworld")],
  ["pack", bops.from("this is a long binary blob right? Right!")]
];

var messages2 = [
  "git-upload-pack /js-git\0host=localhost\0",
  "52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n",
  "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n",
  "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n",
  "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n",
  null,  // pkt-flush events are encoded as null
  "",    // So they can be distinguished from empty strings
  "hi\n",
  "want 0000000000000000000000000000000000000000\n",
  null,
  "hi\0ofs-delta hat party\n",
  true,
  bops.from("PACKhelloworld"),
  bops.from("this is a long binary blob right? Right!")
];

var framed = [
  "002bgit-upload-pack /js-git\0host=localhost\0",
  "00ad52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n",
  "003f52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n",
  "004652bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n",
  "004852bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n",
  "0000",
  "0004",
  "0007hi\n",
  "0032want 0000000000000000000000000000000000000000\n",
  "0000",
  "001bhi\0ofs-delta hat party\n",
  "PACKhelloworld",
  "this is a long binary blob right? Right!"
];


function toBinary(string) {
  if (string === null || string === true) return string;
  if (typeof string !== "string") return string;
  return bops.from(string);
}

function toString(binary) {
  if (binary === null || binary === true) return binary;
  return bops.to(binary);
}

test('decoder works as expected', function(assert) {

  min.chain
    .source(min.array(chunked.map(toBinary)))
    .push(pktLine.deframer)
    .sink(min.consume.sink(onDeframed));

  function onDeframed(err, items) {
    if (err) throw err;
    items.forEach(function (item, i) {
      if (bops.is(item[1])) {
        assert.equal(item[0], messages[i][0]);
        assert.equal(bops.to(item[1]), bops.to(messages[i][1]));
      }
      else {
        assert.deepEqual(item, messages[i]);
      }
    });
    assert.equal(items.length, messages.length);
    assert.end();
  }

});

test('encoder works as expected', function(assert) {

  min.chain
    .source(min.array(messages2))
    .push(pktLine.framer)
    .sink(min.consume.sink(onFramed));

  function onFramed(err, items) {
    if (err) throw err;
    items = items.map(toString);
    items.forEach(function (item, i) {
      assert.equal(item, framed[i]);
    });
    assert.equal(items.length, framed.length);
    assert.end();
  }

});
