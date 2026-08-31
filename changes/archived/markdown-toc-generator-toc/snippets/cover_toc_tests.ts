// snippet for Cover toc with tests
import { describe, it, expect } from 'vitest';
import { toc } from '../../src/tasks/toc';
describe('toc',()=>{
  it('basic',()=>{ expect(toc("# Hello\n## World")).toBe("- [Hello](#hello)\n  - [World](#world)")});
  it('empty',()=>{ expect(toc("")).toBe("")});
});
