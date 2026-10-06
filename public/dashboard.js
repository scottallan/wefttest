(function () {
  var state = {
    repos: [],
    sortKey: 'stars',
    sortDirection: 'desc',
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

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function renderTable() {
    var tbody = document.getElementById('repo-table-body');
    tbody.innerHTML = '';

    var sorted = window.AuditDashboardSort.sortRepos(state.repos, state.sortKey, state.sortDirection);

    sorted.forEach(function (repo) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(repo.name));
      tr.appendChild(cell(repo.owner));
      tr.appendChild(cell(repo.description || '—'));
      tr.appendChild(cell(repo.visibility));
      tr.appendChild(cell(repo.primaryLanguage || 'None detected'));
      tr.appendChild(cell(formatLanguages(repo)));
      tr.appendChild(cell(String(repo.stars)));
      tr.appendChild(cell(String(repo.forks)));
      tr.appendChild(cell(String(repo.watchers)));
      tr.appendChild(cell(String(repo.openIssuesCount)));
      tr.appendChild(cell(formatPullRequests(repo)));
      tr.appendChild(cell(String(repo.size)));
      tr.appendChild(cell(repo.defaultBranch));
      tr.appendChild(cell(repo.license || 'No license'));
      tr.appendChild(cell(repo.archived ? 'Yes' : 'No'));
      tr.appendChild(cell(repo.disabled ? 'Yes' : 'No'));
      tr.appendChild(cell(formatDate(repo.createdAt)));
      tr.appendChild(cell(formatDate(repo.updatedAt)));
      tr.appendChild(cell(formatDate(repo.pushedAt)));
      tr.appendChild(cell(repo.lastCommitDate ? formatDate(repo.lastCommitDate) : 'Unavailable'));
      tbody.appendChild(tr);
    });
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
      document.getElementById('controls').hidden = false;
      document.getElementById('repo-table').hidden = false;
      renderSummary(data.aggregate);
      renderTable();
    } catch (err) {
      loading.hidden = true;
      showError('Unexpected error loading the dashboard: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('sort-key').addEventListener('change', function (e) {
      state.sortKey = e.target.value;
      renderTable();
    });
    document.getElementById('sort-direction').addEventListener('click', function (e) {
      var current = e.target.getAttribute('data-direction');
      var next = current === 'asc' ? 'desc' : 'asc';
      e.target.setAttribute('data-direction', next);
      e.target.textContent = next === 'asc' ? 'Ascending ▲' : 'Descending ▼';
      state.sortDirection = next;
      renderTable();
    });

    loadDashboard();
  });
})();
