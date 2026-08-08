import { describe, it, expect } from 'vitest';
import { resolve_snippet_files } from '../src/tasks/resolve_snippet_files';

describe('resolve_snippet_files', () => {
  it('works', () => {
    expect(resolve_snippet_files()).toBeDefined();
  });
});
