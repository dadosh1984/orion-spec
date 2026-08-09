import { describe, it, expect } from 'vitest';
import { wire_resolver_forge } from '../src/tasks/wire_resolver_forge';

describe('wire_resolver_forge', () => {
  it('works', () => {
    expect(wire_resolver_forge()).toBeDefined();
  });
});
