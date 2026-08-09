import { describe, it, expect } from 'vitest';
import { lesson_notify_visible } from '../src/tasks/lesson_notify_visible';

describe('lesson_notify_visible', () => {
  it('works', () => {
    expect(lesson_notify_visible()).toBeDefined();
  });
});
