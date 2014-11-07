
# Filesystem Git Database

JSGit repositories need `loadAs`, `saveAs`, `loadRaw`, `saveRaw`, `readRef`, and
`updateRef` methods.
Depending on the backing storage, there are various ways to implement these
methods.
The implementation for in-memory storage is `js-git/mixins/mem-db`, and there
are variants for using Github or IndexDB for storage.

The `js-git/mixins/fs-db` implementation provides these methods as well, but
depends on a file system interface providing `readFile`, `readChunk`,
`writeFile`, and `readDir`.
These file system methods are implemented by the `git-fs-db` and
`git-chrome-db` packages.

For the purpose of this document, `=>` implies that the function does not block
and accepts a Node.js-style callback.
The arrow points to the type of the result.
None of these methods need to return a continuable if the nodeback is missing.

The type `binary` stands for whatever binary representation is appropriate for
the underlying platform.
For browsers, binary is a `Uint8Array`.
For Node.js, binary is a `Buffer`.

## readFile(path) => binary | undefined

Reads the entirety of the file at the given path and produces the binary.
If the file does not exist, readFile provides `undefined` instead.

## readChunk(path, start, end) => binary | undefined

Reads a byte range of the file at the given path.
The byte range is a half open interval, including the byte at the initial index,
and excluding the byte at the terminal index, such that the end minus the start
is the length of the resulting binary data.
The end offset may be negative, in which case it should count back from the end
of the size of the file at the path, such that the size plus the negative end is
the positive end.
If the file does not exist, readChunk provides `undefined` instead.

## writeFile(path, binary) => undefined

Writes the given bytes to the file at the given path.
The method creates any directories leading up to the path if they do not already
exist.

## readDir(path) => array of names | undefined

Reads the names of the entries in the directory at the given path.
The names are not fully qualified paths, just the name of the entry within the
given directory.
