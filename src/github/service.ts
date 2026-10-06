import { GitHubClient } from './client';
import { GitHubRateLimitError } from './errors';
import { AggregateStats, DashboardData, GitHubRepo, RateLimitInfo, RepoAuditData } from './types';

const DETAIL_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function toAuditData(
  repo: GitHubRepo,
  languages: Record<string, number> | null,
  languagesError: boolean,
  openPullRequestsCount: number | null,
  pullRequestsError: boolean,
  lastCommitDate: string | null
): RepoAuditData {
  return {
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    fullName: repo.full_name,
    description: repo.description,
    visibility: repo.private ? 'private' : 'public',
    primaryLanguage: repo.language,
    languages,
    languagesError,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.watchers_count,
    openIssuesCount: repo.open_issues_count,
    openPullRequestsCount,
    pullRequestsError,
    size: repo.size,
    defaultBranch: repo.default_branch,
    license: repo.license ? repo.license.name : null,
    archived: repo.archived,
    disabled: repo.disabled,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    lastCommitDate,
    htmlUrl: repo.html_url,
  };
}

function computeAggregate(repos: RepoAuditData[]): AggregateStats {
  const languageDistribution: Record<string, number> = {};
  let publicRepos = 0;
  let privateRepos = 0;
  let totalStars = 0;
  let totalForks = 0;

  for (const repo of repos) {
    if (repo.visibility === 'public') publicRepos += 1;
    else privateRepos += 1;
    totalStars += repo.stars;
    totalForks += repo.forks;
    if (repo.primaryLanguage) {
      languageDistribution[repo.primaryLanguage] = (languageDistribution[repo.primaryLanguage] || 0) + 1;
    }
  }

  return {
    totalRepos: repos.length,
    publicRepos,
    privateRepos,
    totalStars,
    totalForks,
    languageDistribution,
  };
}

export async function buildDashboard(client: GitHubClient): Promise<DashboardData> {
  const { repos, partial, rateLimit } = await client.listAllRepos();

  let latestRateLimit: RateLimitInfo | null = rateLimit;
  let detailsRateLimited = false;

  const auditRepos = await mapWithConcurrency(repos, DETAIL_CONCURRENCY, async (repo) => {
    let languages: Record<string, number> | null = null;
    let languagesError = false;
    let openPullRequestsCount: number | null = null;
    let pullRequestsError = false;
    let lastCommitDate: string | null = null;

    if (detailsRateLimited) {
      languagesError = true;
      pullRequestsError = true;
    } else {
      try {
        languages = await client.getLanguages(repo.owner.login, repo.name);
      } catch (err) {
        languagesError = true;
        if (err instanceof GitHubRateLimitError) {
          latestRateLimit = err.rateLimit;
          detailsRateLimited = true;
        }
      }

      try {
        openPullRequestsCount = await client.getOpenPullRequestsCount(repo.owner.login, repo.name);
      } catch (err) {
        pullRequestsError = true;
        if (err instanceof GitHubRateLimitError) {
          latestRateLimit = err.rateLimit;
          detailsRateLimited = true;
        }
      }

      try {
        lastCommitDate = await client.getLastCommitDate(repo.owner.login, repo.name, repo.default_branch);
      } catch (err) {
        if (err instanceof GitHubRateLimitError) {
          latestRateLimit = err.rateLimit;
          detailsRateLimited = true;
        }
      }
    }

    return toAuditData(repo, languages, languagesError, openPullRequestsCount, pullRequestsError, lastCommitDate);
  });

  return {
    repos: auditRepos,
    aggregate: computeAggregate(auditRepos),
    partial,
    rateLimit: latestRateLimit,
  };
}
