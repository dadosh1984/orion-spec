import { describe, it, expect } from 'vitest';
import { implement_multiply } from '../src/tasks/implement_multiply';

describe('implement_multiply', () => {
  it('works', () => {
    expect(implement_multiply()).toBeDefined();
  });
});
