'use strinct';
import { FilterService } from '../src/filter';

describe('filter', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = new FilterService();
  });

  it('can be registered and obtained', () => {
    const myFilter = function() {};
    const myFilterFactory = function() {
      return myFilter;
    };

    filterService.register('my', myFilterFactory);
    expect(filterService.filter('my')).toBe(myFilter);
  });
});
