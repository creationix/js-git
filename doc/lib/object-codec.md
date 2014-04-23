# Object Codec

This module implements a codec for the binary git object format for blobs, trees, tags, and commits.

This library is useful for writing new storage backends.  Normal users will probably
just use one of the existing mixins for object storage.

## codec.frame({type,body}) -> buffer

This function accepts an object with `type` and `body` properties.  The `type`
property must be one of "blob", "tree", "commit" or "tag".  The body can be a
pre-encoded raw-buffer or a plain javascript value.  See encoder docs below for
the formats of the different body types.

The returned binary value is the fully framed git object.  The sha1 of this is
the git hash of the object.

```js
var codec = require('js-git/lib/object-codec');
var sha1 = require('git-sha1');

var bin = codec.frame({ type: "blob", body: "Hello World\n"});
var hash = sha1(bin);
```

## codec.deframe(buffer, decode) -> {type,body}

This function accepts a binary git buffer and returns the `{type,body}` object.

If `decode` is true, then the body will also be decoded into a normal javascript
value.  If `decode` is false or missing, then the raw-buffer will be in body.

## codec.encoders

This is an object containing 4 encoder function  Each function has the signature:

    encode(body) -> raw-buffer

Where body is the JS representation of the type and raw-buffer is the git encoded
version of that value, but without the type and length framing.

```js
var encoders = require('js-git/lib/object-codec').encoders;
var modes = require('js-git/lib/modes');
```

Blobs must be native binary values (Buffer in node, Uint8Array in browser).
It's recommended to either use the `bodec` library to create binary values from
strings directly or configure your system with the `formats` mixin that allows
for unicode strings when working with blobs.

```js
rawBin = encoders.blob(new Uint8Array([1,2,3,4,5,6]));
rawBin = encoders.blob(bodec.fromUnicode("Hello World"));
```

Trees are objects with filename as key and object with {mode,hash} as value.
The modes are integers.  It's best to use the modes module to help.

```js
rawBin = encoders.tree({ "greeting.txt": {
  mode: modes.file,
  hash: blobHash
}});
```

Commits are objects with required fields {tree,author,message}
Also if there is a single parent, you specify it with `parent`.

Since a commit can have zero or more parent commits, you specify the parent
hashes via the `parents` property as an array of hashes.

The `author` field is required and contains {name,email,date}.

Commits also require a `committer` field with the same structure as `author`.

The `date` property of `author` and `committer` is in the format {seconds,offset}
Where seconds is a unix timestamp in seconds and offset is the number of minutes
offset for the timezone. (Your local offset can be found with `(new Date).getTimezoneOffset()`)

The `message` fiels is mandatory and a simple string.

```js
rawBin = encoders.commit({
  tree: treeHash,
  author: {
    name: "Tim Caswell",
    email: "tim@creationix.com",
    date: {
      seconds: 1391790910,
      offset: 7 * 60
    }
  },
  parents: [ parentCommitHash ],
  message: "This is a test commit\n"
});
```

Annotated tags are like commits, except they have different fields.

```js
rawBin = encoders.tag({
  object: commitHash,
  type: "commit",
  tag: "mytag",
  tagger: {
    name: "Tim Caswell",
    email: "tim@creationix.com",
    date: {
      seconds: 1391790910,
      offset: 7 * 60
    }
  },
  message: "Tag it!\n"
});
```

## codec.decoders

This is just like `codec.encoders` except these functions do the opposite.
They have the format:

    decode(raw-buffer) -> body

```js
var commit = decoders.commit(rawCommitBin);
```
