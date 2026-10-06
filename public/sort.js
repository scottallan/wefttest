(function (root) {
  var SORT_ACCESSORS = {
    stars: function (repo) { return repo.stars; },
    updatedAt: function (repo) { return new Date(repo.updatedAt).getTime(); },
    size: function (repo) { return repo.size; },
  };

  function sortRepos(repos, key, direction) {
    var accessor = SORT_ACCESSORS[key];
    if (!accessor) {
      throw new Error('Unknown sort key: ' + key);
    }
    var sign = direction === 'asc' ? 1 : -1;
    return repos.slice().sort(function (a, b) {
      var av = accessor(a);
      var bv = accessor(b);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }

  var api = { sortRepos: sortRepos, SORT_ACCESSORS: SORT_ACCESSORS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AuditDashboardSort = api;
  }
})(typeof window !== 'undefined' ? window : undefined);
