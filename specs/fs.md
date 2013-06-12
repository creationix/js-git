# File System

This interface describes the filesystem interface used in the js-git project.

All examples use yield and assume generators with [gen-run][] wrapping, but can be used using ES5 code as well.

```js
// ES6 syntax
var target = yield fs.readlink("/path/to/symlink");

// ES5 syntax
fs.readlink("/path/to/symlink")(function (err, target) {
  if (err) throw err;
  // do something with target
});
```

## stat(path) -> continuable

Stat a file getting mtime, ctime, size, mode, etc as a JS object with the following structure:

  - ctime [seconds, nanoseconds]
  - mtime [seconds, nanoseconds]
  - dev
  - ino
  - mode 1000,1010,1110 | 0755,0644
  - uid
  - gid
  - size

```js
var stat = yield fs.stat("/path/to/my/file.txt");
```

## read(path, [options]) -> source

Open a file by path for reading and return a min-stream read stream.

  - options.start - start at offset
  - options.end - end at offset

```js
var input = fs.read("/path/to/my/file.txt");
```

## write(path, [options]) -> sink

Create a min-stream sink that saves the stream to disk.

  - options.mode - create file with custom mode (base 8 string or integer)

```js
var save = fs.write("/path/to/output.txt");
console.log("Saving input to disk...");
yield save(input);
console.log("Saved");
```

## unlink(path) -> continuable

Delete a file from working directory by path.  returns a continuable.

```js
yield fs.unlink("/file/i/want/to/delete.log");
```

## readlink(path) -> continuable

Read a symlink and give the string it points to.

```js
var target = yield fs.readlink("/path/to/symlink");
```

## symlink(path, target) -> continuable

Create a symlink at path with given target.

```js
yield fs.symlink("/path.to/symlink", "../target");
```

## readdir(path) -> source

Returns a stream of filenames in the target path.

```js
var nameStream = fs.readdir("..");
```

## rmdir(path) -> continuable

Delete a directory.

```js
yield fs.rmdir("/directory/to/kill");
```

## mkdir(path) -> continuable

Create a directory

```js
yield fs.mkdir("/path/to/create");
```

[gen-run]: https://github.com/creationix/gen-run
