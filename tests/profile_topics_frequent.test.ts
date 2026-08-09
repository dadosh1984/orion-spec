import { describe, it, expect } from 'vitest';
import { profile_topics_frequent } from '../src/tasks/profile_topics_frequent';

describe('profile_topics_frequent', () => {
  it('works', () => {
    expect(profile_topics_frequent()).toBeDefined();
  });
});
