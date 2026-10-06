const { sortRepos } = require('../public/sort.js');

function repo(name: string, stars: number, updatedAt: string, size: number) {
  return { name, stars, updatedAt, size };
}

describe('sortRepos', () => {
  const repos = [
    repo('a', 10, '2024-01-01T00:00:00Z', 500),
    repo('b', 50, '2024-03-01T00:00:00Z', 100),
    repo('c', 1, '2024-02-01T00:00:00Z', 900),
  ];

  it('sorts by stars descending', () => {
    const sorted = sortRepos(repos, 'stars', 'desc');
    expect(sorted.map((r: any) => r.name)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by stars ascending', () => {
    const sorted = sortRepos(repos, 'stars', 'asc');
    expect(sorted.map((r: any) => r.name)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by last-updated descending', () => {
    const sorted = sortRepos(repos, 'updatedAt', 'desc');
    expect(sorted.map((r: any) => r.name)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by last-updated ascending', () => {
    const sorted = sortRepos(repos, 'updatedAt', 'asc');
    expect(sorted.map((r: any) => r.name)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by size descending', () => {
    const sorted = sortRepos(repos, 'size', 'desc');
    expect(sorted.map((r: any) => r.name)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by size ascending', () => {
    const sorted = sortRepos(repos, 'size', 'asc');
    expect(sorted.map((r: any) => r.name)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the original array', () => {
    const original = [...repos];
    sortRepos(repos, 'stars', 'asc');
    expect(repos).toEqual(original);
  });

  it('throws on an unknown sort key', () => {
    expect(() => sortRepos(repos, 'unknown', 'asc')).toThrow();
  });
});
