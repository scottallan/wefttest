import nock from 'nock';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const config = loadConfig();

async function loginAgent(agent: ReturnType<typeof request.agent>) {
  const loginRes = await agent.get('/auth/login');
  const state = new URL(loginRes.headers.location).searchParams.get('state')!;
  nock(config.githubOAuthUrl)
    .post('/login/oauth/access_token')
    .reply(200, { access_token: 'gho_testtoken' });
  await agent.get(`/auth/callback?code=validcode&state=${state}`);
}

const rateLimitHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4999',
  'x-ratelimit-reset': '9999999999',
};

afterEach(() => {
  nock.cleanAll();
});

describe('GET /api/repos', () => {
  it('returns an empty dashboard for a zero-repo account', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    await loginAgent(agent);

    nock(config.githubApiUrl).get('/user/repos').query(true).reply(200, [], rateLimitHeaders);

    const res = await agent.get('/api/repos');
    expect(res.status).toBe(200);
    expect(res.body.repos).toEqual([]);
    expect(res.body.aggregate.totalRepos).toBe(0);
  });

  it('redirects to re-authenticate when the session token has been revoked externally', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    await loginAgent(agent);

    nock(config.githubApiUrl).get('/user/repos').query(true).reply(401, { message: 'Bad credentials' });

    const res = await agent.get('/api/repos');
    expect(res.status).toBe(401);
    expect(res.body.redirect).toBe('/');

    // A subsequent request must be treated as unauthenticated (session destroyed).
    const res2 = await agent.get('/api/repos');
    expect(res2.status).toBe(401);
  });

  it('surfaces rate limit info instead of crashing when rate-limited mid-pagination', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    await loginAgent(agent);

    nock(config.githubApiUrl)
      .get('/user/repos')
      .query(true)
      .reply(
        403,
        { message: 'API rate limit exceeded' },
        { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }
      );

    const res = await agent.get('/api/repos');
    expect(res.status).toBe(200);
    expect(res.body.partial).toBe(true);
    expect(res.body.rateLimit).toEqual({ limit: 5000, remaining: 0, reset: 1700000000, resource: undefined });
  });

  it('returns full repo field set for a populated account', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    await loginAgent(agent);

    const repoPayload = {
      id: 1,
      name: 'my-repo',
      full_name: 'octocat/my-repo',
      owner: { login: 'octocat' },
      private: false,
      description: 'desc',
      fork: false,
      html_url: 'https://github.test/octocat/my-repo',
      language: 'Go',
      stargazers_count: 7,
      forks_count: 1,
      watchers_count: 7,
      open_issues_count: 2,
      size: 42,
      default_branch: 'main',
      license: { key: 'apache-2.0', name: 'Apache License 2.0' },
      archived: false,
      disabled: false,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      pushed_at: '2024-01-02T00:00:00Z',
    };

    nock(config.githubApiUrl).get('/user/repos').query(true).reply(200, [repoPayload], rateLimitHeaders);
    nock(config.githubApiUrl).get('/repos/octocat/my-repo/languages').reply(200, { Go: 100 });
    nock(config.githubApiUrl).get('/search/issues').query(true).reply(200, { total_count: 3 });
    nock(config.githubApiUrl).get('/repos/octocat/my-repo/commits').query(true).reply(200, [
      { commit: { committer: { date: '2024-01-03T00:00:00Z' } } },
    ]);

    const res = await agent.get('/api/repos');
    expect(res.status).toBe(200);
    const [repo] = res.body.repos;
    expect(repo).toMatchObject({
      name: 'my-repo',
      owner: 'octocat',
      description: 'desc',
      visibility: 'public',
      primaryLanguage: 'Go',
      languages: { Go: 100 },
      stars: 7,
      forks: 1,
      watchers: 7,
      openIssuesCount: 2,
      openPullRequestsCount: 3,
      size: 42,
      defaultBranch: 'main',
      license: 'Apache License 2.0',
      archived: false,
      disabled: false,
      lastCommitDate: '2024-01-03T00:00:00Z',
    });
  });
});
