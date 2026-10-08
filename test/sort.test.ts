const {
  sortByColumn,
  compareValues,
  stripFormatting,
  toNumeric,
  toDateValue,
  toStringKey,
} = require('../public/sort.js');

function byIdentity(row: any) {
  return row.value;
}

describe('stripFormatting', () => {
  it('removes thousands separators, currency symbols, percent signs, and whitespace', () => {
    expect(stripFormatting('1,234')).toBe('1234');
    expect(stripFormatting('$2')).toBe('2');
    expect(stripFormatting('$1,234.50')).toBe('1234.50');
    expect(stripFormatting('12%')).toBe('12');
    expect(stripFormatting(' 1 234 ')).toBe('1234');
  });
});

describe('toNumeric', () => {
  it('parses plain numbers', () => {
    expect(toNumeric(10)).toBe(10);
    expect(toNumeric('10')).toBe(10);
  });

  it('strips formatting before parsing', () => {
    expect(toNumeric('$2')).toBe(2);
    expect(toNumeric('$10')).toBe(10);
    expect(toNumeric('1,000')).toBe(1000);
    expect(toNumeric('12%')).toBe(12);
  });

  it('treats null/undefined/empty as missing (NaN)', () => {
    expect(isNaN(toNumeric(null))).toBe(true);
    expect(isNaN(toNumeric(undefined))).toBe(true);
    expect(isNaN(toNumeric(''))).toBe(true);
  });
});

describe('toDateValue', () => {
  it('parses ISO dates', () => {
    expect(toDateValue('2024-01-01T00:00:00Z')).toBe(new Date('2024-01-01T00:00:00Z').getTime());
  });

  it('parses differing display formats to the same comparable timeline', () => {
    const iso = toDateValue('2024-03-01T00:00:00Z');
    const humanized = toDateValue('March 1, 2024 00:00:00 UTC');
    expect(iso).toBe(humanized);
  });

  it('treats null/undefined/empty/invalid as missing (NaN)', () => {
    expect(isNaN(toDateValue(null))).toBe(true);
    expect(isNaN(toDateValue(undefined))).toBe(true);
    expect(isNaN(toDateValue(''))).toBe(true);
    expect(isNaN(toDateValue('not a date'))).toBe(true);
  });
});

describe('toStringKey', () => {
  it('lowercases for case-insensitive comparison', () => {
    expect(toStringKey('Banana')).toBe('banana');
    expect(toStringKey('apple')).toBe('apple');
  });

  it('treats null/undefined/empty/whitespace-only as missing (null)', () => {
    expect(toStringKey(null)).toBeNull();
    expect(toStringKey(undefined)).toBeNull();
    expect(toStringKey('')).toBeNull();
    expect(toStringKey('   ')).toBeNull();
  });
});

describe('compareValues', () => {
  it('compares numbers numerically, not lexically', () => {
    expect(compareValues(2, 10, 'number')).toBeLessThan(0);
    expect(compareValues('$2', '$10', 'number')).toBeLessThan(0);
  });

  it('compares dates chronologically', () => {
    expect(compareValues('2024-01-01', '2024-02-01', 'date')).toBeLessThan(0);
  });

  it('compares strings case-insensitively', () => {
    expect(compareValues('apple', 'Banana', 'string')).toBeLessThan(0);
    expect(compareValues('Apple', 'apple', 'string')).toBe(0);
  });

  it('treats missing values as greater than any present value, regardless of type', () => {
    expect(compareValues(null, 5, 'number')).toBeGreaterThan(0);
    expect(compareValues(null, '2024-01-01', 'date')).toBeGreaterThan(0);
    expect(compareValues(null, 'apple', 'string')).toBeGreaterThan(0);
    expect(compareValues(null, null, 'number')).toBe(0);
  });
});

describe('sortByColumn', () => {
  describe('numeric columns', () => {
    const rows = [
      { value: 10 },
      { value: 50 },
      { value: 1 },
    ];

    it('sorts ascending', () => {
      const sorted = sortByColumn(rows, byIdentity, 'number', 'asc');
      expect(sorted.map(byIdentity)).toEqual([1, 10, 50]);
    });

    it('sorts descending', () => {
      const sorted = sortByColumn(rows, byIdentity, 'number', 'desc');
      expect(sorted.map(byIdentity)).toEqual([50, 10, 1]);
    });

    it('sorts formatted currency/percent/comma values by underlying magnitude, like "$2" before "$10"', () => {
      const formatted = [{ value: '$10' }, { value: '$2' }, { value: '1,000' }, { value: '12%' }];
      const sorted = sortByColumn(formatted, byIdentity, 'number', 'asc');
      expect(sorted.map(byIdentity)).toEqual(['$2', '$10', '12%', '1,000']);
    });

    it('does not mutate the original array', () => {
      const original = [...rows];
      sortByColumn(rows, byIdentity, 'number', 'asc');
      expect(rows).toEqual(original);
    });

    it('pins empty/null/missing numeric values to the end in both directions', () => {
      const withGaps = [{ value: 10 }, { value: null }, { value: 5 }, { value: undefined }, { value: '' }];
      const asc = sortByColumn(withGaps, byIdentity, 'number', 'asc');
      expect(asc.map(byIdentity).slice(0, 2)).toEqual([5, 10]);
      const desc = sortByColumn(withGaps, byIdentity, 'number', 'desc');
      expect(desc.map(byIdentity).slice(0, 2)).toEqual([10, 5]);
    });
  });

  describe('date columns', () => {
    it('sorts chronologically regardless of differing display formats', () => {
      const rows = [
        { value: '2024-03-01T00:00:00Z' },
        { value: 'January 1, 2024 00:00:00 UTC' },
        { value: '2024-02-01T00:00:00Z' },
      ];
      const sorted = sortByColumn(rows, byIdentity, 'date', 'asc');
      expect(sorted.map(byIdentity)).toEqual([
        'January 1, 2024 00:00:00 UTC',
        '2024-02-01T00:00:00Z',
        '2024-03-01T00:00:00Z',
      ]);
    });

    it('sorts descending', () => {
      const rows = [
        { value: '2024-01-01T00:00:00Z' },
        { value: '2024-03-01T00:00:00Z' },
        { value: '2024-02-01T00:00:00Z' },
      ];
      const sorted = sortByColumn(rows, byIdentity, 'date', 'desc');
      expect(sorted.map(byIdentity)).toEqual([
        '2024-03-01T00:00:00Z',
        '2024-02-01T00:00:00Z',
        '2024-01-01T00:00:00Z',
      ]);
    });

    it('pins missing/invalid/null dates (e.g. no lastCommitDate) to the end, not crashing', () => {
      const rows = [
        { value: '2024-02-01T00:00:00Z' },
        { value: null },
        { value: '2024-01-01T00:00:00Z' },
        { value: undefined },
      ];
      expect(() => sortByColumn(rows, byIdentity, 'date', 'asc')).not.toThrow();
      const asc = sortByColumn(rows, byIdentity, 'date', 'asc');
      expect(asc.map(byIdentity).slice(0, 2)).toEqual(['2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z']);
      expect(asc.slice(2).map(byIdentity)).toEqual(expect.arrayContaining([null, undefined]));
    });
  });

  describe('string columns', () => {
    it('sorts case-insensitively', () => {
      const rows = [{ value: 'Banana' }, { value: 'apple' }, { value: 'Cherry' }];
      const sorted = sortByColumn(rows, byIdentity, 'string', 'asc');
      expect(sorted.map(byIdentity)).toEqual(['apple', 'Banana', 'Cherry']);
    });

    it('sorts descending', () => {
      const rows = [{ value: 'Banana' }, { value: 'apple' }, { value: 'Cherry' }];
      const sorted = sortByColumn(rows, byIdentity, 'string', 'desc');
      expect(sorted.map(byIdentity)).toEqual(['Cherry', 'Banana', 'apple']);
    });

    it('pins empty/null/missing strings (e.g. no description) to the end', () => {
      const rows = [{ value: 'zeta' }, { value: null }, { value: 'alpha' }, { value: '' }];
      const asc = sortByColumn(rows, byIdentity, 'string', 'asc');
      expect(asc.map(byIdentity).slice(0, 2)).toEqual(['alpha', 'zeta']);
    });
  });

  describe('general behavior', () => {
    it('is a no-op on zero rows', () => {
      expect(sortByColumn([], byIdentity, 'number', 'asc')).toEqual([]);
    });

    it('is a no-op on a single row', () => {
      const rows = [{ value: 42 }];
      expect(sortByColumn(rows, byIdentity, 'number', 'asc').map(byIdentity)).toEqual([42]);
    });

    it('is stable for equal values, preserving original relative order', () => {
      const rows = [
        { value: 5, tag: 'first' },
        { value: 5, tag: 'second' },
        { value: 5, tag: 'third' },
      ];
      const sorted = sortByColumn(rows, byIdentity, 'number', 'asc');
      expect(sorted.map((r: any) => r.tag)).toEqual(['first', 'second', 'third']);
    });

    it('produces a consistent result when re-applied an even vs. odd number of times (toggle simulation)', () => {
      const rows = [{ value: 10 }, { value: 50 }, { value: 1 }];
      let direction: 'asc' | 'desc' = 'asc';
      let sorted = rows;
      for (let i = 0; i < 3; i++) {
        sorted = sortByColumn(rows, byIdentity, 'number', direction);
        direction = direction === 'asc' ? 'desc' : 'asc';
      }
      // after 3 toggles starting at 'asc' (asc, desc, asc) the last applied direction is 'asc'
      expect(sorted.map(byIdentity)).toEqual([1, 10, 50]);
    });
  });
});
