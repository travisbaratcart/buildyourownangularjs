'use strict';
import { FilterService} from '../src/filter';

describe('filter filter', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = FilterService.getInstance();
  });

  it('is available', () => {
    expect(filterService.filter('filter')).toBeDefined();
  });
});
