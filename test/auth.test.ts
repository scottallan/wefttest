import nock from 'nock';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const config = loadConfig();

describe('authentication gating', () => {
  const app = createApp(config);

  it('redirects unauthenticated requests to /dashboard.html to the login page', async () => {
    const res = await request(app).get('/dashboard.html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('rejects unauthenticated requests to /api/repos with 401 and a redirect hint', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ redirect: '/' });
  });

  it('rejects unauthenticated requests to /api/user with 401', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
  });
});

describe('OAuth login flow', () => {
  const app = createApp(config);

  afterEach(() => {
    nock.cleanAll();
  });

  it('redirects /auth/login to GitHub authorize endpoint with required scopes', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin).toBe(config.githubOAuthUrl);
    expect(location.pathname).toBe('/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe(config.githubClientId);
    expect(location.searchParams.get('scope')).toContain('repo');
    expect(location.searchParams.get('scope')).toContain('read:user');
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  it('shows an error state when GitHub callback reports denied consent', async () => {
    const res = await request(app).get('/auth/callback?error=access_denied');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?error=access_denied');
  });

  it('rejects a callback with a state that does not match the session', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/login');
    const res = await agent.get('/auth/callback?code=abc123&state=not-the-real-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?error=invalid_state');
  });

  it('completes the OAuth code exchange and establishes a session on success', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.get('/auth/login');
    const state = new URL(loginRes.headers.location).searchParams.get('state')!;

    nock(config.githubOAuthUrl)
      .post('/login/oauth/access_token')
      .reply(200, { access_token: 'gho_testtoken', token_type: 'bearer', scope: 'repo,read:user' });

    const callbackRes = await agent.get(`/auth/callback?code=validcode&state=${state}`);
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/dashboard.html');

    nock(config.githubApiUrl).get('/user').reply(200, { login: 'octocat' });
    const userRes = await agent.get('/api/user');
    expect(userRes.status).toBe(200);
    expect(userRes.body).toEqual({ login: 'octocat' });
  });

  it('shows an error state when the token exchange fails', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.get('/auth/login');
    const state = new URL(loginRes.headers.location).searchParams.get('state')!;

    nock(config.githubOAuthUrl)
      .post('/login/oauth/access_token')
      .reply(200, { error: 'bad_verification_code' });

    const callbackRes = await agent.get(`/auth/callback?code=badcode&state=${state}`);
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/?error=bad_verification_code');
  });

  it('logout clears the session so the dashboard redirects back to login', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.get('/auth/login');
    const state = new URL(loginRes.headers.location).searchParams.get('state')!;
    nock(config.githubOAuthUrl)
      .post('/login/oauth/access_token')
      .reply(200, { access_token: 'gho_testtoken' });
    await agent.get(`/auth/callback?code=validcode&state=${state}`);

    const dashBefore = await agent.get('/dashboard.html');
    expect(dashBefore.status).toBe(200);

    const logoutRes = await agent.get('/auth/logout');
    expect(logoutRes.status).toBe(302);

    const dashAfter = await agent.get('/dashboard.html');
    expect(dashAfter.status).toBe(302);
    expect(dashAfter.headers.location).toBe('/');
  });
});
