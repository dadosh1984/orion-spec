import { describe, it, expect } from 'vitest';
import { capability_manifest_forge } from '../src/tasks/capability_manifest_forge';

describe('capability_manifest_forge', () => {
  it('works', () => {
    expect(capability_manifest_forge()).toBeDefined();
  });
});
