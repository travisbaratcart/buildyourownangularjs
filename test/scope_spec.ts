import { Scope } from '../src/scope';

describe('Scope', () => {
  it('can be constructed and used as an object', () => {
    const scope = new Scope();
    scope.aProperty = 1;
    expect(scope.aProperty).toBe(1);
  });
});
