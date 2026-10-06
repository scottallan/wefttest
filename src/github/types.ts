export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  fork: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  license: { key: string; name: string; spdx_id: string } | null;
  archived: boolean;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // unix seconds
  resource?: string;
}

export interface RepoAuditData {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  description: string | null;
  visibility: 'public' | 'private';
  primaryLanguage: string | null;
  languages: Record<string, number> | null;
  languagesError: boolean;
  stars: number;
  forks: number;
  watchers: number;
  openIssuesCount: number;
  openPullRequestsCount: number | null;
  pullRequestsError: boolean;
  size: number;
  defaultBranch: string;
  license: string | null;
  archived: boolean;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  lastCommitDate: string | null;
  htmlUrl: string;
}

export interface AggregateStats {
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
  totalStars: number;
  totalForks: number;
  languageDistribution: Record<string, number>;
}

export interface DashboardData {
  repos: RepoAuditData[];
  aggregate: AggregateStats;
  partial: boolean;
  rateLimit: RateLimitInfo | null;
}
