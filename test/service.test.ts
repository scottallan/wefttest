import nock from 'nock';
import { GitHubClient } from '../src/github/client';
import { buildDashboard } from '../src/github/service';

const API_URL = 'https://api.github.test';

function repo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: Math.floor(Math.random() * 100000),
    name: 'repo-a',
    full_name: 'octocat/repo-a',
    owner: { login: 'octocat' },
    private: false,
    description: null,
    fork: false,
    html_url: 'https://github.test/octocat/repo-a',
    language: null,
    stargazers_count: 5,
    forks_count: 2,
    watchers_count: 5,
    open_issues_count: 3,
    size: 128,
    default_branch: 'main',
    license: null,
    archived: false,
    disabled: false,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

const rateLimitHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4999',
  'x-ratelimit-reset': '9999999999',
};

afterEach(() => {
  nock.cleanAll();
});

describe('buildDashboard', () => {
  it('returns an empty dashboard for a zero-repo account', async () => {
    nock(API_URL).get('/user/repos').query(true).reply(200, [], rateLimitHeaders);
    const client = new GitHubClient('token', API_URL);
    const dashboard = await buildDashboard(client);

    expect(dashboard.repos).toEqual([]);
    expect(dashboard.aggregate).toEqual({
      totalRepos: 0,
      publicRepos: 0,
      privateRepos: 0,
      totalStars: 0,
      totalForks: 0,
      languageDistribution: {},
    });
    expect(dashboard.partial).toBe(false);
  });

  it('computes aggregates consistent with the per-repo rows and fills in missing fields', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query(true)
      .reply(
        200,
        [
          repo({ id: 1, name: 'repo-public', private: false, stargazers_count: 10, forks_count: 1, language: 'TypeScript' }),
          repo({ id: 2, name: 'repo-private', private: true, stargazers_count: 3, forks_count: 0, language: 'Python', license: { key: 'mit', name: 'MIT License' } }),
        ],
        rateLimitHeaders
      );

    nock(API_URL).get('/repos/octocat/repo-public/languages').reply(200, { TypeScript: 100 });
    nock(API_URL)
      .get('/search/issues')
      .query({ q: 'repo:octocat/repo-public+type:pr+state:open', per_page: '1' })
      .reply(200, { total_count: 1 });
    nock(API_URL)
      .get('/repos/octocat/repo-public/commits')
      .query(true)
      .reply(200, [{ commit: { committer: { date: '2024-06-01T00:00:00Z' } } }]);

    nock(API_URL).get('/repos/octocat/repo-private/languages').reply(200, { Python: 50 });
    nock(API_URL)
      .get('/search/issues')
      .query({ q: 'repo:octocat/repo-private+type:pr+state:open', per_page: '1' })
      .reply(200, { total_count: 0 });
    nock(API_URL)
      .get('/repos/octocat/repo-private/commits')
      .query(true)
      .reply(200, [{ commit: { committer: { date: '2024-06-02T00:00:00Z' } } }]);

    const client = new GitHubClient('token', API_URL);
    const dashboard = await buildDashboard(client);

    expect(dashboard.repos).toHaveLength(2);
    expect(dashboard.aggregate.totalRepos).toBe(2);
    expect(dashboard.aggregate.publicRepos).toBe(1);
    expect(dashboard.aggregate.privateRepos).toBe(1);
    expect(dashboard.aggregate.totalStars).toBe(13);
    expect(dashboard.aggregate.totalForks).toBe(1);
    expect(dashboard.aggregate.languageDistribution).toEqual({ TypeScript: 1, Python: 1 });

    const publicRepo = dashboard.repos.find((r) => r.name === 'repo-public')!;
    expect(publicRepo.visibility).toBe('public');
    expect(publicRepo.description).toBeNull();
    expect(publicRepo.license).toBeNull();
    expect(publicRepo.languages).toEqual({ TypeScript: 100 });
    expect(publicRepo.openPullRequestsCount).toBe(1);
    expect(publicRepo.lastCommitDate).toBe('2024-06-01T00:00:00Z');

    const privateRepo = dashboard.repos.find((r) => r.name === 'repo-private')!;
    expect(privateRepo.license).toBe('MIT License');
  });

  it('still renders a repo with all other fields when its language call fails', async () => {
    nock(API_URL).get('/user/repos').query(true).reply(200, [repo({ id: 1, name: 'lang-fail-repo' })], rateLimitHeaders);
    nock(API_URL).get('/repos/octocat/lang-fail-repo/languages').reply(500, { message: 'boom' });
    nock(API_URL).get('/search/issues').query(true).reply(200, { total_count: 2 });
    nock(API_URL).get('/repos/octocat/lang-fail-repo/commits').query(true).reply(200, []);

    const client = new GitHubClient('token', API_URL);
    const dashboard = await buildDashboard(client);

    expect(dashboard.repos).toHaveLength(1);
    const r = dashboard.repos[0];
    expect(r.languagesError).toBe(true);
    expect(r.languages).toBeNull();
    expect(r.openPullRequestsCount).toBe(2);
    expect(r.pullRequestsError).toBe(false);
  });

  it('marks archived and disabled repos correctly end to end', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query(true)
      .reply(200, [repo({ id: 1, name: 'archived-repo', archived: true, disabled: true })], rateLimitHeaders);
    nock(API_URL).get('/repos/octocat/archived-repo/languages').reply(200, {});
    nock(API_URL).get('/search/issues').query(true).reply(200, { total_count: 0 });
    nock(API_URL).get('/repos/octocat/archived-repo/commits').query(true).reply(200, []);

    const client = new GitHubClient('token', API_URL);
    const dashboard = await buildDashboard(client);
    expect(dashboard.repos[0].archived).toBe(true);
    expect(dashboard.repos[0].disabled).toBe(true);
  });

  it('propagates partial=true and rate limit info when pagination is cut short', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query(true)
      .reply(
        403,
        { message: 'API rate limit exceeded' },
        { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }
      );

    const client = new GitHubClient('token', API_URL);
    const dashboard = await buildDashboard(client);
    expect(dashboard.partial).toBe(true);
    expect(dashboard.repos).toEqual([]);
    expect(dashboard.rateLimit).toEqual({ limit: 5000, remaining: 0, reset: 1700000000, resource: undefined });
  });
});
