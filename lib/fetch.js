module.exports = function (platform) {
  return fetch;
  function fetch(repo, url, callback) {
    if (!callback) return fetch.bind(this, repo, url);
    console.log({
      repo: repo,
      url: url
    });
    throw new Error("TODO: Implement fetch");
  }
}
