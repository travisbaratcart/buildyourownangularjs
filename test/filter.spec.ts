'use strinct';
import * as _ from 'lodash';
import { publishExternalAPI } from '../src/angularPublic';
import { $FilterProvider } from '../src/filter';
import { createInjector, IProvide } from '../src/injector';
import { IParseService } from '../src/parse';
import { Angular } from '../src/loader';

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
    const parse: IParseService = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('upcase', function() {
        return function(str: string) {
          return str.toUpperCase();
        };
      });
    }]).get('$parse');

    const result = (parse('aString | upcase'));
    expect(result({ aString: 'Hello' })).toBe('HELLO');
  });

  it('can parse filter chain expressions', () => {
    const parse: IParseService = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('upcase', function() {
        return function(str: string) {
          return str.toUpperCase();
        }
      })

      $filterProvider.register('exclamate', function() {
        return function(str: string) {
          return str + '!';
        }
      })
    }]).get('$parse');


    const result = parse('"hello" | upcase | exclamate');

    expect(result()).toBe('HELLO!');
  });

  it('can pass an additional argument to filters', () => {
    const parse: IParseService = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('repeat', function() {
        return function(str: string, times: number) {
          return _.repeat(str, times);
        }
      });
    }]).get('$parse');

    const result = parse('"hello" | repeat:3');
    expect(result()).toBe('hellohellohello');
  });

  it('can pass several additional arguments to filters', () => {
    const parse: IParseService = createInjector(['ng', function($filterProvider: $FilterProvider) {
      $filterProvider.register('surround', function() {
        return function(str: string, left: string, right: string) {
          return left + str + right;
        };
      });
    }]).get('$parse');

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

  it('can be registred through module API', () => {
    const myFilter = function() { };

    const module = (<Angular>((<any>window).angular)).module('myModule', [])

    module.filter('my', function() {
      return myFilter;
    });

    const injector = createInjector(['ng', 'myModule']);

    expect(injector.has('myFilter')).toBe(true);
    expect(injector.get('myFilter')).toBe(myFilter);
  });
});
