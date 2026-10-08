(function (root) {
  // Strips thousands separators, currency symbols, and percent signs so that
  // formatted display text (e.g. "$2", "1,000", "12%") can be compared numerically.
  function stripFormatting(value) {
    return String(value).replace(/[,$%\s]/g, '');
  }

  function toNumeric(value) {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'number') return value;
    var stripped = stripFormatting(value);
    if (stripped === '' || stripped === '-') return NaN;
    var n = parseFloat(stripped);
    return n;
  }

  function toDateValue(value) {
    if (value === null || value === undefined || value === '') return NaN;
    var t = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return isNaN(t) ? NaN : t;
  }

  function toStringKey(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    return s === '' ? null : s.toLowerCase();
  }

  function normalize(value, type) {
    if (type === 'number') return toNumeric(value);
    if (type === 'date') return toDateValue(value);
    return toStringKey(value);
  }

  function isMissing(normalized, type) {
    return type === 'string' ? normalized === null : isNaN(normalized);
  }

  // Compares two raw (possibly formatted/display) values according to a sort
  // type. Missing values (null/undefined/empty/unparseable) always compare as
  // "greater" so they consistently land at the end of an ascending sort.
  function compareValues(a, b, type) {
    var an = normalize(a, type);
    var bn = normalize(b, type);
    var aMissing = isMissing(an, type);
    var bMissing = isMissing(bn, type);

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }

  // Sorts `rows` by the value produced by `getValue(row)`, interpreted as
  // `type` ('number' | 'date' | 'string'). The sort is stable and
  // non-mutating; missing values are always pinned to the end regardless of
  // direction, so toggling direction never makes them jump around.
  function sortByColumn(rows, getValue, type, direction) {
    var sign = direction === 'asc' ? 1 : -1;
    return rows
      .map(function (row, index) { return { row: row, index: index }; })
      .sort(function (a, b) {
        var an = normalize(getValue(a.row), type);
        var bn = normalize(getValue(b.row), type);
        var aMissing = isMissing(an, type);
        var bMissing = isMissing(bn, type);

        if (aMissing && bMissing) return a.index - b.index;
        if (aMissing) return 1;
        if (bMissing) return -1;

        if (an < bn) return -1 * sign;
        if (an > bn) return 1 * sign;
        return a.index - b.index;
      })
      .map(function (entry) { return entry.row; });
  }

  var api = {
    stripFormatting: stripFormatting,
    toNumeric: toNumeric,
    toDateValue: toDateValue,
    toStringKey: toStringKey,
    compareValues: compareValues,
    sortByColumn: sortByColumn,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AuditDashboardSort = api;
  }
})(typeof window !== 'undefined' ? window : undefined);
