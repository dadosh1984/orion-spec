import { describe, it, expect } from 'vitest';
import { profile_store_read } from '../src/tasks/profile_store_read';

describe('profile_store_read', () => {
  it('works', () => {
    expect(profile_store_read()).toBeDefined();
  });
});
