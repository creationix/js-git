"use strict";
var modes = require('./modes');
var defer = require('./defer');
exports = function (repo, options) {
    let toWrite = {};
    let callbacks = [];
    let writing = false;
    return {
        readFile: readFile,
        writeFile: writeFile,
        readDir: readDir
    };
    function readFile(path, callback) {
        if (!callback)
            return readFile.bind(null, path);
        if (toWrite[path])
            return callback(null, toWrite[path]);
        options.getRootTree(onRootTree);
        function onRootTree(err, hash) {
            if (!hash)
                return callback(err);
            repo.pathToEntry(hash, path, onEntry);
        }
        function onEntry(err, entry) {
            if (!entry || !modes.isBlob(entry.mode))
                return callback(err);
            repo.loadAs("blob", entry.hash, function (err, content) {
                if (!content)
                    return callback(err);
                if (entry.mode === modes.sym) {
                    content = options.decrypt(content);
                }
                callback(null, content);
            });
        }
    }
    function writeFile(path, binary, callback) {
        if (!callback)
            return writeFile.bind(null, path, binary);
        toWrite[path] = binary;
        callbacks.push(callback);
        defer(check);
    }
    function readDir(path, callback) {
        if (!callback)
            return readDir.bind(null, path);
        options.getRootTree(onRootTree);
        function onRootTree(err, hash) {
            if (!hash)
                return callback(err);
            repo.pathToEntry(hash, path, onEntry);
        }
        function onEntry(err, entry) {
            if (!entry || entry.mode !== modes.tree)
                return callback(err);
            repo.loadAs("tree", entry.hash, onTree);
        }
        function onTree(err, tree) {
            if (!tree)
                return callback(err);
            callback(null, Object.keys(tree));
        }
    }
    function check() {
        if (writing || !callbacks.length)
            return;
        writing = true;
        options.getRootTree(onRootTree);
        function onRootTree(err, hash) {
            if (err)
                return callall(err);
            let files = pullFiles();
            if (hash)
                files.base = hash;
            repo.createTree(files, onNewTree);
        }
        function onNewTree(err, hash) {
            if (err)
                return callall(err);
            options.setRootTree(hash, onSaveRoot);
        }
        function onSaveRoot(err) {
            if (err)
                return callall(err);
            writing = false;
            callall();
            defer(check);
        }
    }
    function pullFiles() {
        let files = Object.keys(toWrite).map(function (path) {
            let content = toWrite[path];
            delete toWrite[path];
            let mode = modes.blob;
            if (options.shouldEncrypt && options.shouldEncrypt(path)) {
                mode = modes.sym;
                content = options.encrypt(content);
            }
            return {
                path: path,
                mode: mode,
                content: content
            };
        });
        return files;
    }
    function callall(err) {
        callbacks.splice(0, callbacks.length).forEach(function (callback) {
            callback(err);
        });
    }
};
