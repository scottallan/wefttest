(function () {
  var state = {
    repos: [],
    sortKey: null,
    sortDirection: null,
  };

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  }

  function formatLanguages(repo) {
    if (repo.languagesError) return 'Unavailable';
    if (!repo.languages || Object.keys(repo.languages).length === 0) return 'None detected';
    return Object.keys(repo.languages)
      .map(function (lang) { return lang; })
      .join(', ');
  }

  function formatPullRequests(repo) {
    if (repo.pullRequestsError) return 'Unavailable';
    if (repo.openPullRequestsCount === null || repo.openPullRequestsCount === undefined) return '—';
    return String(repo.openPullRequestsCount);
  }

  function pullRequestsSortValue(repo) {
    if (repo.pullRequestsError) return null;
    return repo.openPullRequestsCount;
  }

  function languagesSortValue(repo) {
    if (repo.languagesError) return 'unavailable';
    return formatLanguages(repo);
  }

  // Column order here must match the <th> order in dashboard.html exactly —
  // it drives both cell rendering and per-column sort comparisons.
  var COLUMNS = [
    { key: 'name', type: 'string', display: function (r) { return r.name; }, sortValue: function (r) { return r.name; } },
    { key: 'owner', type: 'string', display: function (r) { return r.owner; }, sortValue: function (r) { return r.owner; } },
    { key: 'description', type: 'string', display: function (r) { return r.description || '—'; }, sortValue: function (r) { return r.description; } },
    { key: 'visibility', type: 'string', display: function (r) { return r.visibility; }, sortValue: function (r) { return r.visibility; } },
    { key: 'primaryLanguage', type: 'string', display: function (r) { return r.primaryLanguage || 'None detected'; }, sortValue: function (r) { return r.primaryLanguage; } },
    { key: 'languages', type: 'string', display: formatLanguages, sortValue: languagesSortValue },
    { key: 'stars', type: 'number', display: function (r) { return String(r.stars); }, sortValue: function (r) { return r.stars; } },
    { key: 'forks', type: 'number', display: function (r) { return String(r.forks); }, sortValue: function (r) { return r.forks; } },
    { key: 'watchers', type: 'number', display: function (r) { return String(r.watchers); }, sortValue: function (r) { return r.watchers; } },
    { key: 'openIssuesCount', type: 'number', display: function (r) { return String(r.openIssuesCount); }, sortValue: function (r) { return r.openIssuesCount; } },
    { key: 'openPullRequestsCount', type: 'number', display: formatPullRequests, sortValue: pullRequestsSortValue },
    { key: 'size', type: 'number', display: function (r) { return String(r.size); }, sortValue: function (r) { return r.size; } },
    { key: 'defaultBranch', type: 'string', display: function (r) { return r.defaultBranch; }, sortValue: function (r) { return r.defaultBranch; } },
    { key: 'license', type: 'string', display: function (r) { return r.license || 'No license'; }, sortValue: function (r) { return r.license; } },
    { key: 'archived', type: 'string', display: function (r) { return r.archived ? 'Yes' : 'No'; }, sortValue: function (r) { return r.archived ? 'Yes' : 'No'; } },
    { key: 'disabled', type: 'string', display: function (r) { return r.disabled ? 'Yes' : 'No'; }, sortValue: function (r) { return r.disabled ? 'Yes' : 'No'; } },
    { key: 'createdAt', type: 'date', display: function (r) { return formatDate(r.createdAt); }, sortValue: function (r) { return r.createdAt; } },
    { key: 'updatedAt', type: 'date', display: function (r) { return formatDate(r.updatedAt); }, sortValue: function (r) { return r.updatedAt; } },
    { key: 'pushedAt', type: 'date', display: function (r) { return formatDate(r.pushedAt); }, sortValue: function (r) { return r.pushedAt; } },
    { key: 'lastCommitDate', type: 'date', display: function (r) { return r.lastCommitDate ? formatDate(r.lastCommitDate) : 'Unavailable'; }, sortValue: function (r) { return r.lastCommitDate; } },
  ];

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function renderTable() {
    var tbody = document.getElementById('repo-table-body');
    tbody.innerHTML = '';

    var rows = state.repos;
    if (state.sortKey) {
      var column = COLUMNS.filter(function (c) { return c.key === state.sortKey; })[0];
      rows = window.AuditDashboardSort.sortByColumn(rows, column.sortValue, column.type, state.sortDirection);
    }

    rows.forEach(function (repo) {
      var tr = document.createElement('tr');
      COLUMNS.forEach(function (column) {
        tr.appendChild(cell(column.display(repo)));
      });
      tbody.appendChild(tr);
    });
  }

  function updateSortIndicators() {
    var headers = document.querySelectorAll('#repo-table th[data-key]');
    headers.forEach(function (th) {
      var key = th.getAttribute('data-key');
      var indicator = th.querySelector('.sort-indicator');
      if (key === state.sortKey) {
        var ascending = state.sortDirection === 'asc';
        th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
        th.classList.add('is-sorted');
        indicator.textContent = ascending ? '▲' : '▼';
      } else {
        th.setAttribute('aria-sort', 'none');
        th.classList.remove('is-sorted');
        indicator.textContent = '';
      }
    });
  }

  function handleHeaderClick(th) {
    var key = th.getAttribute('data-key');
    if (state.sortKey === key) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDirection = 'asc';
    }
    updateSortIndicators();
    renderTable();
  }

  function renderSummary(aggregate) {
    document.getElementById('stat-total').textContent = aggregate.totalRepos;
    document.getElementById('stat-public').textContent = aggregate.publicRepos;
    document.getElementById('stat-private').textContent = aggregate.privateRepos;
    document.getElementById('stat-stars').textContent = aggregate.totalStars;
    document.getElementById('stat-forks').textContent = aggregate.totalForks;

    var list = document.getElementById('stat-language-list');
    list.innerHTML = '';
    Object.keys(aggregate.languageDistribution)
      .sort(function (a, b) { return aggregate.languageDistribution[b] - aggregate.languageDistribution[a]; })
      .forEach(function (lang) {
        var span = document.createElement('span');
        span.className = 'language-chip';
        span.textContent = lang + ': ' + aggregate.languageDistribution[lang];
        list.appendChild(span);
      });
  }

  function renderRateLimit(rateLimit) {
    var banner = document.getElementById('rate-limit-banner');
    if (!rateLimit) {
      banner.hidden = true;
      return;
    }
    var nearlyExhausted = rateLimit.remaining <= Math.max(1, Math.floor(rateLimit.limit * 0.05));
    if (rateLimit.remaining === 0 || nearlyExhausted) {
      var resetDate = new Date(rateLimit.reset * 1000);
      banner.textContent =
        'GitHub API rate limit: ' + rateLimit.remaining + '/' + rateLimit.limit +
        ' remaining. Resets at ' + resetDate.toLocaleTimeString() + '.';
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function showError(message) {
    var errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  async function loadDashboard() {
    var loading = document.getElementById('loading');
    try {
      var res = await fetch('/api/repos', { credentials: 'same-origin' });
      if (res.status === 401) {
        var body = await res.json().catch(function () { return {}; });
        window.location.href = body.redirect || '/';
        return;
      }
      if (!res.ok) {
        showError('Failed to load dashboard data from the server.');
        return;
      }
      var data = await res.json();
      loading.hidden = true;

      state.repos = data.repos;
      document.getElementById('partial-banner').hidden = !data.partial;
      renderRateLimit(data.rateLimit);

      if (data.repos.length === 0) {
        document.getElementById('empty-state').hidden = false;
        document.getElementById('summary').hidden = false;
        renderSummary(data.aggregate);
        return;
      }

      document.getElementById('summary').hidden = false;
      document.getElementById('repo-table').hidden = false;
      renderSummary(data.aggregate);
      updateSortIndicators();
      renderTable();
    } catch (err) {
      loading.hidden = true;
      showError('Unexpected error loading the dashboard: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('#repo-table th[data-key]').forEach(function (th) {
      th.querySelector('.sort-btn').addEventListener('click', function () {
        handleHeaderClick(th);
      });
    });

    loadDashboard();
  });
})();
