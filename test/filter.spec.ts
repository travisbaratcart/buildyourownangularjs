'use strinct';
import * as _ from 'lodash';
import { publishExternalAPI } from '../src/angularPublic';
import { $FilterProvider } from '../src/filter';
import { createInjector, IProvide } from '../src/injector';
import { parse } from '../src/parse';

describe('filter', () => {
  beforeEach(() => {
    publishExternalAPI();
  });

  it('can be registered and obtained', () => {
    const myFilter = function() {};
    const myFilterFactory = function() {
      return myFilter;
    };

    const injector = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('my', myFilterFactory);
    }]);

    const $filter = injector.get('$filter');

    expect($filter('my')).toBe(myFilter);
  });

  it('allows registering multiple filters with an object', () => {
    const myFilter = function() {};
    const myOtherFilter = function() {};


    const injector = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register({
        my: function() {
          return myFilter;
        },
        myOther: function() {
          return myOtherFilter;
        }
      });
    }]);

    const $filter = injector.get('$filter');

    expect($filter('my')).toBe(myFilter);
    expect($filter('myOther')).toBe(myOtherFilter);
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

  it('is available through the injector', () => {
    const myFilter = function() { };

    const injector = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('my', function() {
        return myFilter;
      });
    }]);

    expect(injector.has('myFilter')).toBe(true);
    expect(injector.get('myFilter')).toBe(myFilter);
  });

  it('may have dependencies in factory', () => {
    const injector = createInjector(['ng', function($provide: IProvide, $filterProvider: $FilterProvider) {
      $provide.constant('suffix', '!');

      $filterProvider.register('my', function(suffix: string) {
        return function(str: string) {
          return str + suffix;
        };
      });
    }]);

    expect(injector.has('myFilter')).toBe(true);
  });
});
