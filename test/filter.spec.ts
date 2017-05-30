'use strinct';
import * as _ from 'lodash';
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

  it('can parse filter chain expressions', () => {
    filterService.register('upcase', function() {
      return function(str: string) {
        return str.toUpperCase();
      }
    })

    filterService.register('exclamate', function() {
      return function(str: string) {
        return str + '!';
      }
    })

    const result = parse('"hello" | upcase | exclamate');

    expect(result()).toBe('HELLO!');
  });

  it('can pass an additional argument to filters', () => {
    filterService.register('repeat', function() {
      return function(str: string, times: number) {
        return _.repeat(str, times);
      }
    })

    const result = parse('"hello" | repeat:3');
    expect(result()).toBe('hellohellohello');
  });

  it('can pass several additional arguments to filters', () => {
    filterService.register('surround', function() {
      return function(str: string, left: string, right: string) {
        return left + str + right;
      };
    })

    const result = parse('"hello" | surround:"*":"!"');
    expect(result()).toBe('*hello!');
  });
});
