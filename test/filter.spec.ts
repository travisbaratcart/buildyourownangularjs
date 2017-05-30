'use strinct';
import { FilterService } from '../src/filter';
import { parse } from '../src/parse';

describe('filter', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = FilterService.getInstance();
  });

  it('can be registered and obtained', () => {
    const myFilter = function() {};
    const myFilterFactory = function() {
      return myFilter;
    };

    filterService.register('my', myFilterFactory);
    expect(filterService.filter('my')).toBe(myFilter);
  });

  it('allows registering multiple filters with an objectd', () => {
    const myFilter = function() {};
    const myOtherFilter = function() {};

    filterService.register({
      my: function() {
        return myFilter;
      },
      myOther: function() {
        return myOtherFilter;
      }
    });

    expect(filterService.filter('my')).toBe(myFilter);
    expect(filterService.filter('myOther')).toBe(myOtherFilter);
  });

  it('can parse filter expressions', () => {
    filterService.register('upcase', function() {
      return function(str: string) {
        return str.toUpperCase();
      };
    });

    const result = (parse('aString | upcase'));
    expect(result({ aString: 'Hello' })).toBe('HELLO');
  });
});
