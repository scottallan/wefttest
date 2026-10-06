import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { GitHubRepo, RateLimitInfo } from './types';
import { GitHubAuthError, GitHubRateLimitError } from './errors';

function parseRateLimit(res: AxiosResponse): RateLimitInfo | null {
  const limit = res.headers['x-ratelimit-limit'];
  const remaining = res.headers['x-ratelimit-remaining'];
  const reset = res.headers['x-ratelimit-reset'];
  const resource = res.headers['x-ratelimit-resource'];
  if (limit === undefined || remaining === undefined || reset === undefined) {
    return null;
  }
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    reset: Number(reset),
    resource: typeof resource === 'string' ? resource : undefined,
  };
}

function parseNextLink(linkHeader: string | undefined): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match && match[2] === 'next') {
      return match[1];
    }
  }
  return null;
}

function isRateLimitResponse(res: AxiosResponse): boolean {
  if (res.status !== 403 && res.status !== 429) return false;
  const remaining = res.headers['x-ratelimit-remaining'];
  if (remaining !== undefined && Number(remaining) === 0) return true;
  const message = (res.data && (res.data as any).message) || '';
  return typeof message === 'string' && /rate limit/i.test(message);
}

export interface ListReposResult {
  repos: GitHubRepo[];
  partial: boolean;
  rateLimit: RateLimitInfo | null;
}

export class GitHubClient {
  private http: AxiosInstance;

  constructor(private accessToken: string, baseURL: string) {
    this.http = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      validateStatus: () => true,
    });
  }

  private checkCommonErrors(res: AxiosResponse): void {
    if (res.status === 401) {
      throw new GitHubAuthError();
    }
  }

  async getAuthenticatedUser(): Promise<{ login: string }> {
    const res = await this.http.get('/user');
    this.checkCommonErrors(res);
    if (isRateLimitResponse(res)) {
      throw new GitHubRateLimitError(parseRateLimit(res)!);
    }
    if (res.status >= 400) {
      throw new Error(`Failed to fetch authenticated user: ${res.status}`);
    }
    return res.data;
  }

  async listAllRepos(): Promise<ListReposResult> {
    const repos: GitHubRepo[] = [];
    let url: string | null = '/user/repos';
    let params: Record<string, unknown> | undefined = {
      per_page: 100,
      affiliation: 'owner,collaborator,organization_member',
      visibility: 'all',
      sort: 'full_name',
    };
    let lastRateLimit: RateLimitInfo | null = null;

    while (url) {
      const res: AxiosResponse = await this.http.get(url, { params });
      params = undefined; // only needed on first request; subsequent `next` links are absolute/full
      this.checkCommonErrors(res);
      lastRateLimit = parseRateLimit(res) ?? lastRateLimit;

      if (isRateLimitResponse(res)) {
        return { repos, partial: true, rateLimit: lastRateLimit };
      }

      if (res.status >= 400) {
        throw new Error(`Failed to list repositories: ${res.status}`);
      }

      const page = res.data as GitHubRepo[];
      repos.push(...page);

      const nextUrl = parseNextLink(res.headers['link']);
      url = nextUrl;
    }

    return { repos, partial: false, rateLimit: lastRateLimit };
  }

  async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const res = await this.http.get(`/repos/${owner}/${repo}/languages`);
    this.checkCommonErrors(res);
    if (isRateLimitResponse(res)) {
      throw new GitHubRateLimitError(parseRateLimit(res)!);
    }
    if (res.status >= 400) {
      throw new Error(`Failed to fetch languages for ${owner}/${repo}: ${res.status}`);
    }
    return res.data;
  }

  async getOpenPullRequestsCount(owner: string, repo: string): Promise<number> {
    const res = await this.http.get('/search/issues', {
      params: { q: `repo:${owner}/${repo}+type:pr+state:open`, per_page: 1 },
    });
    this.checkCommonErrors(res);
    if (isRateLimitResponse(res)) {
      throw new GitHubRateLimitError(parseRateLimit(res)!);
    }
    if (res.status >= 400) {
      throw new Error(`Failed to fetch open PR count for ${owner}/${repo}: ${res.status}`);
    }
    return res.data.total_count;
  }

  async getLastCommitDate(owner: string, repo: string, branch: string): Promise<string | null> {
    const res = await this.http.get(`/repos/${owner}/${repo}/commits`, {
      params: { sha: branch, per_page: 1 },
    });
    this.checkCommonErrors(res);
    if (isRateLimitResponse(res)) {
      throw new GitHubRateLimitError(parseRateLimit(res)!);
    }
    if (res.status >= 400) {
      throw new Error(`Failed to fetch last commit for ${owner}/${repo}: ${res.status}`);
    }
    const commits = res.data as Array<{ commit: { committer: { date: string } | null; author: { date: string } | null } }>;
    if (!commits.length) return null;
    return commits[0].commit.committer?.date ?? commits[0].commit.author?.date ?? null;
  }
}

export { parseNextLink, parseRateLimit, isRateLimitResponse };
