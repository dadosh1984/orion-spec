import { describe, it, expect } from 'vitest';
import { cover_resolver_tests } from '../src/tasks/cover_resolver_tests';

describe('cover_resolver_tests', () => {
  it('works', () => {
    expect(cover_resolver_tests()).toBeDefined();
  });
});
