var sha1 = require('../lib/sha1.js');

var tests = [
  "", "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  "a", "86f7e437faa5a7fce15d1ddcb9eaeaea377667b8",
  "abc", "a9993e364706816aba3e25717850c26c9cd0d89d",
  "message digest", "c12252ceda8be8994d5fa0290a47231c1d16aae3",
  "abcdefghijklmnopqrstuvwxyz", "32d10c7b8cf96570ca04ce37f2a19d84240d3a89",
  "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "84983e441c3bd26ebaae4aa1f95129e5e54670f1",
  "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabc",
    "a6319f25020d5ff8722d40ae750dbab67d94fe4f",
  "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZab",
    "edb3a03256d1c6d148034ec4795181931c933f46",
  "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZa",
    "677734f7bf40b2b244cae100bf365598fbf4741d",
];

for (var i = 0; i < tests.length; i += 2) {
  var input = tests[i];
  console.log("\n" + JSON.stringify(input));
  var expectedHex = tests[i + 1];
  console.log(expectedHex);
  var hash = sha1(input);
  console.log(hash);
  if (hash !== expectedHex) {
    throw new Error(hash + " != " + expectedHex + " for '" + input + "'");
  }
  var sha1sum = sha1();
  for (var j = 0, l = input.length; j < l; j += 17) {
    sha1sum.update(input.substr(j, 17));
  }
  hash = sha1sum.digest();
  console.log(hash);
  if (hash !== expectedHex) {
    throw new Error(hash + " != " + expectedHex + " for '" + input + "'");
  }
}

console.log("\n1,000,000 repetitions of the character 'a'");
var expectedHex = "34aa973cd4c4daa4f61eeb2bdbad27316534016f";
console.log(expectedHex);
var sha1sum = sha1();
for (var i = 0; i < 100000; i++) {
  sha1sum.update("aaaaaaaaaa");
}
var hash = sha1sum.digest();
console.log(hash);
if (hash !== expectedHex) {
  throw new Error(hash + " != " + expectedHex + " for '" + input + "'");
}
