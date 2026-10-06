import { Request, Response, Router } from 'express';
import { Config } from '../config';
import { requireAuthApi } from '../auth/middleware';
import { GitHubClient } from '../github/client';
import { GitHubAuthError, GitHubRateLimitError } from '../github/errors';
import { buildDashboard } from '../github/service';

export function createApiRouter(config: Config): Router {
  const router = Router();
  router.use(requireAuthApi);

  router.get('/user', async (req, res) => {
    const client = new GitHubClient(req.session.accessToken!, config.githubApiUrl);
    try {
      const user = await client.getAuthenticatedUser();
      res.status(200).json({ login: user.login });
    } catch (err) {
      await handleGitHubError(err, req, res);
    }
  });

  router.get('/repos', async (req, res) => {
    const client = new GitHubClient(req.session.accessToken!, config.githubApiUrl);
    try {
      const dashboard = await buildDashboard(client);
      res.status(200).json(dashboard);
    } catch (err) {
      await handleGitHubError(err, req, res);
    }
  });

  return router;
}

async function handleGitHubError(err: unknown, req: Request, res: Response): Promise<void> {
  if (err instanceof GitHubAuthError) {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.status(401).json({ error: 'session_expired', redirect: '/' });
    return;
  }
  if (err instanceof GitHubRateLimitError) {
    res.status(200).json({
      repos: [],
      aggregate: {
        totalRepos: 0,
        publicRepos: 0,
        privateRepos: 0,
        totalStars: 0,
        totalForks: 0,
        languageDistribution: {},
      },
      partial: true,
      rateLimit: err.rateLimit,
    });
    return;
  }
  res.status(502).json({ error: 'github_api_error', message: (err as Error).message });
}
