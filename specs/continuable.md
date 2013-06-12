# Continuable

A continable is nothing more than a function that accepts a single node.js style callback.  It's like an ultra lightweight promise.

JS-Git uses continuables internally in place of callback-last for async functions.

## Consuming a Continuable with Generators

If you're lucky enough to have a platform with ES6 generators, I highly recommend using something like [gen-run][] to comsume them.

```js
var stat = fs.stat("/path/to/file");
```

## Consuming a Continuable using Callbacks

If you're not so lucky or just plain prefer callbacks, that works fine too.

```js
fs.stat("/path/to/file")(onStat);

function onStat(err, stat) {
  if (err) return handleError(err);
  // otherwise do something with stat
}
```

## Wrapping a Callback based Function

If you want to wrap an existing library function that uses plain callback, it's very simple.

Here is how we turn `setTimeout(callback, ms)` into `sleep(ms)(callback)`.

```js
function sleep(ms) {
  return function (callback) {
    setTimeout(callback, ms);
  };
}
```

Or here is how I would wrap a [node.js][] style stat function to a continuable style function.

```js
function stat(path) {
  return function (callback) {
    fs.stat(path, callback);
  };
}

var continuable = stat("/some/path");
```

Or if you prefer, you can use bind directly for callback-last functions.

```js
var continuable = fs.stat.bind(fs, "/some/path");
```

[gen-run]: https://github.com/creationix/gen-run
[node.js]: http://nodejs.org/
