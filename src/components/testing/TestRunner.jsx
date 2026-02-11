/**
 * Lightweight in-browser test engine for PDV Event Pro.
 * Provides describe/it/expect pattern without external dependencies.
 * Used by TestDashboard "Unit Tests" tab.
 *
 * DECISION LOG: Vitest BLOCKED on Base44 (2026-02-11).
 * This is the approved alternative for pure utility function testing.
 */

let suites = [];
let currentSuite = null;

function createAssertionError(message, expected, actual) {
  const e = new Error(message);
  e.expected = expected;
  e.actual = actual;
  return e;
}

export function describe(name, fn) {
  currentSuite = { name, tests: [], passed: 0, failed: 0 };
  try {
    fn();
  } catch (e) {
    // Suite-level error — record as a failed test
    currentSuite.tests.push({
      name: '(suite setup error)',
      status: 'fail',
      error: { message: e.message, expected: undefined, actual: undefined },
    });
  }
  currentSuite.passed = currentSuite.tests.filter(t => t.status === 'pass').length;
  currentSuite.failed = currentSuite.tests.filter(t => t.status === 'fail').length;
  suites.push(currentSuite);
  currentSuite = null;
}

export function it(name, fn) {
  const test = { name, status: 'pass', error: null };
  try {
    fn();
  } catch (e) {
    test.status = 'fail';
    test.error = { message: e.message, expected: e.expected, actual: e.actual };
  }
  if (currentSuite) {
    currentSuite.tests.push(test);
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw createAssertionError(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
          expected, actual
        );
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw createAssertionError(
          `Expected deep equal.\nExpected: ${b}\nActual:   ${a}`,
          expected, actual
        );
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw createAssertionError(
          `Expected truthy but got ${JSON.stringify(actual)}`,
          'truthy', actual
        );
      }
    },
    toBeFalsy() {
      if (actual) {
        throw createAssertionError(
          `Expected falsy but got ${JSON.stringify(actual)}`,
          'falsy', actual
        );
      }
    },
    toContain(item) {
      const has = Array.isArray(actual) ? actual.includes(item) : String(actual).includes(item);
      if (!has) {
        throw createAssertionError(
          `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`,
          item, actual
        );
      }
    },
    toHaveLength(len) {
      if (actual.length !== len) {
        throw createAssertionError(
          `Expected length ${len} but got ${actual.length}`,
          len, actual.length
        );
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw createAssertionError(
          `Expected null but got ${JSON.stringify(actual)}`,
          null, actual
        );
      }
    },
    toBeGreaterThanOrEqual(n) {
      if (!(actual >= n)) {
        throw createAssertionError(
          `Expected ${actual} >= ${n}`,
          `>= ${n}`, actual
        );
      }
    },
  };
}

export function runAll(suiteFns) {
  suites = [];
  suiteFns.forEach(fn => fn());
  return [...suites];
}

export function runSuite(suiteFn) {
  suites = [];
  suiteFn();
  return [...suites];
}
