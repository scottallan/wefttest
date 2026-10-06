import nock from 'nock';
import { GitHubClient } from '../src/github/client';
import { GitHubAuthError, GitHubRateLimitError } from '../src/github/errors';

const API_URL = 'https://api.github.test';

function repo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'repo-a',
    full_name: 'octocat/repo-a',
    owner: { login: 'octocat' },
    private: false,
    description: 'A repo',
    fork: false,
    html_url: 'https://github.test/octocat/repo-a',
    language: 'TypeScript',
    stargazers_count: 5,
    forks_count: 2,
    watchers_count: 5,
    open_issues_count: 3,
    size: 128,
    default_branch: 'main',
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    archived: false,
    disabled: false,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  nock.cleanAll();
});

describe('GitHubClient.listAllRepos', () => {
  it('follows Link header pagination across multiple pages', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query({ per_page: '100', affiliation: 'owner,collaborator,organization_member', visibility: 'all', sort: 'full_name' })
      .reply(200, [repo({ id: 1, name: 'repo-1' })], {
        link: `<${API_URL}/user/repos?page=2>; rel="next", <${API_URL}/user/repos?page=3>; rel="last"`,
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '9999999999',
      });

    nock(API_URL)
      .get('/user/repos')
      .query({ page: '2' })
      .reply(200, [repo({ id: 2, name: 'repo-2' })], {
        link: `<${API_URL}/user/repos?page=3>; rel="next", <${API_URL}/user/repos?page=3>; rel="last"`,
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4998',
        'x-ratelimit-reset': '9999999999',
      });

    nock(API_URL)
      .get('/user/repos')
      .query({ page: '3' })
      .reply(200, [repo({ id: 3, name: 'repo-3' })], {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4997',
        'x-ratelimit-reset': '9999999999',
      });

    const client = new GitHubClient('token', API_URL);
    const result = await client.listAllRepos();

    expect(result.partial).toBe(false);
    expect(result.repos.map((r) => r.name)).toEqual(['repo-1', 'repo-2', 'repo-3']);
    expect(result.rateLimit).toEqual({ limit: 5000, remaining: 4997, reset: 9999999999, resource: undefined });
  });

  it('handles zero accessible repositories', async () => {
    nock(API_URL).get('/user/repos').query(true).reply(200, [], {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '9999999999',
    });

    const client = new GitHubClient('token', API_URL);
    const result = await client.listAllRepos();
    expect(result.repos).toEqual([]);
    expect(result.partial).toBe(false);
  });

  it('returns a partial result set and rate limit info when rate-limited mid-pagination', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query({ per_page: '100', affiliation: 'owner,collaborator,organization_member', visibility: 'all', sort: 'full_name' })
      .reply(200, [repo({ id: 1, name: 'repo-1' })], {
        link: `<${API_URL}/user/repos?page=2>; rel="next"`,
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '1',
        'x-ratelimit-reset': '9999999999',
      });

    nock(API_URL)
      .get('/user/repos')
      .query({ page: '2' })
      .reply(
        403,
        { message: 'API rate limit exceeded for user ID 1.' },
        {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1700000000',
        }
      );

    const client = new GitHubClient('token', API_URL);
    const result = await client.listAllRepos();

    expect(result.partial).toBe(true);
    expect(result.repos.map((r) => r.name)).toEqual(['repo-1']);
    expect(result.rateLimit).toEqual({ limit: 5000, remaining: 0, reset: 1700000000, resource: undefined });
  });

  it('throws GitHubAuthError when the token is expired or revoked', async () => {
    nock(API_URL).get('/user/repos').query(true).reply(401, { message: 'Bad credentials' });

    const client = new GitHubClient('token', API_URL);
    await expect(client.listAllRepos()).rejects.toBeInstanceOf(GitHubAuthError);
  });

  it('includes archived and disabled repos with correct flags', async () => {
    nock(API_URL)
      .get('/user/repos')
      .query(true)
      .reply(200, [repo({ id: 9, name: 'old-repo', archived: true, disabled: true })], {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '9999999999',
      });

    const client = new GitHubClient('token', API_URL);
    const result = await client.listAllRepos();
    expect(result.repos[0].archived).toBe(true);
    expect(result.repos[0].disabled).toBe(true);
  });
});

describe('GitHubClient per-repo detail calls', () => {
  it('fetches language breakdown', async () => {
    nock(API_URL).get('/repos/octocat/repo-a/languages').reply(200, { TypeScript: 1000, JavaScript: 200 });
    const client = new GitHubClient('token', API_URL);
    const languages = await client.getLanguages('octocat', 'repo-a');
    expect(languages).toEqual({ TypeScript: 1000, JavaScript: 200 });
  });

  it('throws when the language call fails', async () => {
    nock(API_URL).get('/repos/octocat/repo-a/languages').reply(500, { message: 'oops' });
    const client = new GitHubClient('token', API_URL);
    await expect(client.getLanguages('octocat', 'repo-a')).rejects.toThrow();
  });

  it('throws GitHubRateLimitError when language call is rate-limited', async () => {
    nock(API_URL)
      .get('/repos/octocat/repo-a/languages')
      .reply(
        403,
        { message: 'API rate limit exceeded' },
        { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }
      );
    const client = new GitHubClient('token', API_URL);
    await expect(client.getLanguages('octocat', 'repo-a')).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it('fetches open pull request count via search API', async () => {
    nock(API_URL)
      .get('/search/issues')
      .query({ q: 'repo:octocat/repo-a+type:pr+state:open', per_page: '1' })
      .reply(200, { total_count: 4, items: [] });
    const client = new GitHubClient('token', API_URL);
    const count = await client.getOpenPullRequestsCount('octocat', 'repo-a');
    expect(count).toBe(4);
  });

  it('fetches the last commit date for the default branch', async () => {
    nock(API_URL)
      .get('/repos/octocat/repo-a/commits')
      .query({ sha: 'main', per_page: '1' })
      .reply(200, [{ commit: { committer: { date: '2024-05-01T12:00:00Z' }, author: { date: '2024-05-01T11:00:00Z' } } }]);
    const client = new GitHubClient('token', API_URL);
    const date = await client.getLastCommitDate('octocat', 'repo-a', 'main');
    expect(date).toBe('2024-05-01T12:00:00Z');
  });
});
