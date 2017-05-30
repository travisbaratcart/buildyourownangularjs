'use strict';
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
});
