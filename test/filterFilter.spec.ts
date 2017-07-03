'use strict';
import * as _ from 'lodash';
import { publishExternalAPI } from '../src/angularPublic';
import { IParseService } from '../src/parse';
import { createInjector } from '../src/injector';

describe('filter filter', () => {
  let parse: IParseService;

  beforeEach(() => {
    publishExternalAPI();
    parse = createInjector(['ng']).get('$parse');
  });

  it('is available', () => {
    const injector = createInjector(['ng']);
    expect(injector.has('filterFilter')).toBe(true);
  });

  it('can filter an array with a predicate function', () => {
    const result = parse('[1, 2, 3, 4] | filter:isOdd');

    const scope: any = {
      isOdd: (num: number) => num % 2 !== 0
    };

    expect(result(scope)).toEqual([1, 3]);
  });

  it('can filter an array of strings with a string', () => {
    const result = parse('arr | filter:"a"');
    expect(result({ arr: ['a', 'b', 'a']})).toEqual(['a', 'a']);
  });

  it('filters an array of strings with substring matching', () => {
    const result = parse('arr | filter:"o"');

    expect(result({ arr: ['quick', 'brown', 'fox'] })).toEqual(['brown', 'fox']);
  });

  it('filters an array of strings ignoring case', () => {
    const result = parse('arr | filter:"o"');

    expect(result({ arr: ['quick', 'BROWN', 'fox']})).toEqual(['BROWN', 'fox']);
  });

  it('filters an array of objects where any value matches', () => {
    const result = parse('arr | filter:"o"');

    expect(result({ arr: [
      { firstName: 'John', lastName: 'Brown'},
      { firstName: 'Jane', lastName: 'Fox'},
      { firstName: 'Mary', lastName: 'Quick'}
    ]})).toEqual([
      { firstName: 'John', lastName: 'Brown'},
      { firstName: 'Jane', lastName: 'Fox'}
    ]);
  });

  it('filters an array of objects where a nested value matches', () => {
    const result = parse('arr | filter:"o"');

    expect(result({ arr: [
      { name: { first: 'John', last: 'Brown' } },
      { name: { first: 'Jane', last: 'Fox' } },
      { name: { first: 'Mary', last: 'Quick' } }
    ]})).toEqual([
      { name: { first: 'John', last: 'Brown' } },
      { name: { first: 'Jane', last: 'Fox' } }
    ]);
  });

  it('filters an rray of arrays where a nested value matches', () => {
    const result = parse('arr | filter:"o"');

    expect(result({ arr: [
      [{ name: 'John' }, { name: 'Mary' }],
      [{ name: 'Jane' }]
    ]})).toEqual([
      [{ name: 'John' }, { name: 'Mary' }]
    ]);
  });

  it('filters with a number', () => {
    const result = parse('arr | filter:42');

    expect(result({ arr: [
      { name: 'Mary', age: 42},
      { name: 'John', age: 43},
      { name: 'Jane', age: 44}
    ]})).toEqual([
      { name: 'Mary', age: 42}
    ]);
  });

  it('filters with a boolean', () => {
    const result = parse('arr | filter:true');

    expect(result({ arr: [
      { name: 'Mary', admin: true},
      { name: 'John', admin: true},
      { name: 'Jane', admin: false}
    ]})).toEqual([
      { name: 'Mary', admin: true},
      { name: 'John', admin: true}
    ]);
  });

  it('filters with a substring numeric value', () => {
    const result = parse('arr | filter:42');
    expect(result({ arr: ['contains 42', 10420] })).toEqual(['contains 42', 10420]);
  });

  it('filters matching null', () => {
    const result = parse('arr | filter:null');

    expect(result({ arr: [null, 'not null']})).toEqual([null]);
  });

  it('does not match null value with the string null', () => {
    const result = parse('arr | filter:"null"');
    expect(result({ arr: [null, 'not null'] })).toEqual(['not null']);
  });

  it('does not match undefined values', () => {
    const result = parse('arr | filter:"undefined"');
    expect(result({ arr: [undefined, 'undefined']})).toEqual(['undefined']);
  });

  it('allows negating string filter', () => {
    const result = parse('arr | filter:"!o"');
    expect(result({ arr: ['quick', 'brown', 'fox'] })).toEqual(['quick']);
  });

  it('filters with an object', () => {
    const result = parse('arr | filter:{name: "o"}');
    expect(result({ arr: [
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]})).toEqual([
      { name: 'Joe', role: 'admin' }
    ]);
  });

  it('must match all criteria in an object', () => {
    const result = parse('arr | filter:{name: "o", role: "m"}');

    expect(result({ arr: [
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]})).toEqual([
      { name: 'Joe', role: 'admin' }
    ]);
  });

  it('matches everything when filtered with an empty object', () => {
    const result = parse('arr | filter: {}');

    expect(result({ arr: [
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]})).toEqual([
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]);
  });

  it('filters with a nested object', () => {
    const result = parse('arr | filter:{name: {first: "o"}}');

    expect(result({ arr: [
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' }
    ]})).toEqual([
      { name: { first: 'Joe' }, role: 'admin' }
    ]);
  });

  it('allows negation when filtering with an object', () => {
    const result = parse('arr | filter:{name: {first: "!o"}}');

    expect(result({ arr: [
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' }
    ]})).toEqual([
      { name: { first: 'Jane' }, role: 'moderator' }
    ]);
  });

  it('ignores undefined values in expectation object', () => {
    const result = parse('arr | filter:{name: thisIsUndefined}');

    expect(result({ arr: [
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]})).toEqual([
      { name: 'Joe', role: 'admin' },
      { name: 'Jane', role: 'moderator' }
    ]);
  });

  it('filters with a nested object in an array', () => {
    const result = parse('arr | filter:{users: {name: {first: "o" }}}');

    expect(result({ arr: [
      { users: [
        { name: { first: 'Joe' }, role: 'admin'},
        { name: { first: 'Jane' }, role: 'moderator'},
      ]},
      { users: [
        { name: { first: 'Mary', role: 'admin'} },
      ]}
    ]})).toEqual([
      { users: [
        { name: { first: 'Joe' }, role: 'admin'},
        { name: { first: 'Jane' }, role: 'moderator'},
      ]}
    ]);
  })

  it('filters with nested objects on the same level only', () => {
    const items = [
      {user: 'Bob'},
      { user: { name: 'Bob' } },
      { user: { name: { first: 'Bob', last: 'Fox' } } }
    ];

    const result = parse('arr | filter:{ user: { name: "Bob" } }');

    expect(result({ arr: items })).toEqual([{ user: { name: 'Bob' } }]);
  });

  it('fiilters with a wildcard property', () => {
    const result = parse('arr | filter:{ $: "o" }');

    expect(result({ arr: [
      { name: 'Joe', role: 'admin'},
      { name: 'Jane', role: 'moderator'},
      { name: 'Mary', role: 'admin'}
    ]})).toEqual([
      { name: 'Joe', role: 'admin'},
      { name: 'Jane', role: 'moderator'}
    ]);
  });

  it('filters nested object with a wildcard property', () => {
    const result = parse('arr | filter: { $: "o" }');

    expect(result({ arr: [
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' },
      { name: { first: 'Mary' }, role: 'admin' }
    ]})).toEqual([
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' }
    ]);
  });

  it('filters wildcard properties scoped to parent', () => {
    const result = parse('arr | filter: { name: { $: "o" } }');

    expect(result({ arr: [
      { name: { first: 'Joe', last: 'Fox' }, role: 'admin' },
      { name: { first: 'Jane', last: 'Quick' }, role: 'moderator' },
      { name: { first: 'Mary', last: 'Brown' }, role: 'admin' }
    ]})).toEqual([
      { name: { first: 'Joe', last: 'Fox' }, role: 'admin' },
      { name: { first: 'Mary', last: 'Brown' }, role: 'admin' }
    ]);
  });

  it('filters primitives with a wildcard property', () => {
    const result = parse('arr | filter: { $: "o" }');

    expect(result({ arr: ['Joe', 'Jane', 'Mary'] })).toEqual(['Joe']);
  });

  it('filters with a nested wildcard property', () => {
    const result = parse('arr | filter: { $: { $: "o" } }')

    expect(result({ arr: [
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' },
      { name: { first: 'Mary' }, role: 'admin' }
    ]})).toEqual([
      { name: { first: 'Joe' }, role: 'admin' }
    ]);
  });

  it('allows using a custom comparator', () => {
    const result = parse('arr | filter: { $: "o" }: myComparator');

    expect(result({
      arr: ['o', 'oo', 'ao', 'aa'],
      myComparator: function(left: any, right: any) {
        return left === right;
      }
    })).toEqual(['o']);
  });

  it('allows using an equality comparator', () => {
    const result = parse('arr | filter: { name: "Jo" }:true');

    expect(result({ arr: [
      { name: 'Jo' },
      { name: 'Joe' }
    ]})).toEqual([
      { name: 'Jo' }
    ]);
  });
});
