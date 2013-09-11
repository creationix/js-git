// Mock data for generating some history
exports.author = { name: "Tim Caswell", email: "tim@creationix.com" };
exports.committer = { name: "JS-Git", email: "js-git@creationix.com" };
exports.commits = {
  "Initial Commit\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n"
  },
  "Add package.json and blank module\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n",
    "package.json": '{\n  "name": "awesome-lib",\n  "version": "3.1.3",\n  "main": "awesome.js"\n}\n',
    "awesome.js": 'module.exports = function () {\n  throw new Error("TODO: Implement Awesome");\n};\n'
  },
  "Implement awesome and bump version to 3.1.4\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n",
    "package.json": '{\n  "name": "awesome-lib",\n  "version": "3.1.4",\n  "main": "awesome.js"\n}\n',
    "awesome.js": 'module.exports = function () {\n  return 42;\n};\n'
  }
};
