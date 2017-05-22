import { parse } from '../src/parse';

describe('parse', () => {
  it('can parse an integer', () => {
    let result = parse('42');
    expect(result).toBeDefined();
    expect(result()).toBe(42);
  });
});
