import { describe, it, expect } from 'vitest';
import { profile_cli_view } from '../src/tasks/profile_cli_view';

describe('profile_cli_view', () => {
  it('works', () => {
    expect(profile_cli_view()).toBeDefined();
  });
});
