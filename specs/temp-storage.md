# Temporary Storage

This interface is used by git-list-pack to store streaming data temporarily when applying deltas.  It allows for storing and retrieving temporary data.

## store(stream, name) -> continuable

Store the stream to named bucket.  Continuable resolves on completion or error.

## load(name) -> stream

Load back a saved store.  If it's not there, wait for it to be there before emitting events on the stream.

## clear() -> continuable

We're done with the store, release all saved resources.  If there are any waiting load calls, flush them all with ENOENT errors.
