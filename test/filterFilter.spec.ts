'use strict';
import * as _ from 'lodash';
import { FilterService} from '../src/filter';
import { parse } from '../src/parse';

describe('filter filter', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = FilterService.getInstance();
  });

  it('is available', () => {
    expect(filterService.filter('filter')).toBeDefined();
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
});
