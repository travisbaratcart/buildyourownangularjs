'use strict';
import { setupModuleLoder, Angular } from '../src/loader';
import { createInjector } from '../src/injector';

describe('injector', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;

    setupModuleLoder(window);

    angular = (<any>window).angular;
  });

  it('can be created', () => {
    const injector = createInjector([]);
    expect(injector).toBeDefined();
  });

  it('has a constant that has been registered to a module', () => {
    const module = angular.module('myModule', []);
    module.constant('aConstant', 42);

    const injector = createInjector(['myModule']);
    expect(injector.has('aConstant')).toBe(true);
  });

  it('does not have a non-registered constant', () => {
    const module = angular.module('myModule', []);
    const injector = createInjector(['myModule']);

    expect(injector.has('aConstant')).toBe(false);
  });

  it('loads multiple modules', () => {
    const module1 = angular.module('myModule', []);
    const module2 = angular.module('myOtherModule', []);

    module1.constant('aConstant', 42);
    module2.constant('anotherConstant', 43);

    const injector = createInjector(['myModule', 'myOtherModule']);

    expect(injector.has('aConstant')).toBe(true);
    expect(injector.has('anotherConstant')).toBe(true);
  });

  it('loads the required modules of a module', () => {
    const module1 = angular.module('myModule', []);
    const module2 = angular.module('myOtherModule', ['myModule']);

    module1.constant('aConstant', 42);
    module2.constant('anotherConstant', 43);

    const injector = createInjector(['myOtherModule']);

    expect(injector.has('aConstant')).toBe(true);
    expect(injector.has('anotherConstant')).toBe(true);
  });

  it('loads the transitively required modules of a module', () => {
    const module1 = angular.module('myModule', []);
    const module2 = angular.module('myOtherModule', ['myModule']);
    const module3 = angular.module('myThirdModule', ['myOtherModule']);

    module1.constant('aConstant', 42);
    module1.constant('anotherConstant', 43);
    module1.constant('aThirdConstant', 44);

    const injector = createInjector(['myThirdModule']);

    expect(injector.has('aConstant')).toBe(true);
    expect(injector.has('anotherConstant')).toBe(true);
    expect(injector.has('aThirdConstant')).toBe(true);
  });

  it('loads each module only once', () => {
    angular.module('myModule', ['myOtherModule']);
    angular.module('myOtherModule', ['myModule']);

    createInjector(['myModule']);
  });

  it('invokes an annotated function with dependency injection', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    const fn: any = (one: number, two: number) => one + two;

    fn.$inject = ['a', 'b'];

    expect(injector.invoke(fn)).toBe(3);
  });

  it('does not accept non-strings as injection tokens', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);

    const injector = createInjector(['myModule']);

    const func: any = (one: number, two: number) => one + two;

    func.$inject = ['a', 2];

    expect(() => injector.invoke(func)).toThrow();
  });

  it('invokes a function with the given this context', () => {
    const module = angular.module('myModule', []);
    module.constant('a', 1);

    const injector = createInjector(['myModule']);

    const obj: any = {
      two: 2,
      func: function(one: number) { return one + this.two }
    };

    obj.func.$inject = ['a'];

    expect(injector.invoke(obj.func, obj)).toBe(3);
  });

  it('overrides dependencies with locals when invoking', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    const func: any = (one: number, two: number) => one + two;

    func.$inject = ['a', 'b'];

    expect(injector.invoke(func, undefined, { b: 3 })).toBe(4);
  });

  describe('annotateDependencies', () => {
    it('returns the $inject annotation of a function when it has one', () => {
      const injector = createInjector([]);

      const func: any = function() {};

      func.$inject = ['a', 'b'];

      expect(injector.annotateDependencies(func)).toEqual(['a', 'b']);
    });

    it('returns the array-style annotations of a function', () => {
      const injector = createInjector([]);

      const func = ['a', 'b', function() {}];

      expect(injector.annotateDependencies(func)).toEqual(['a', 'b']);
    });

    it('returns an empty array for a non-annotated 0-arg function', () => {
      const injector = createInjector([]);

      const func = function() {};

      expect(injector.annotateDependencies(func)).toEqual([]);
    });

    it('returns annotations parsed from functions arguments when not annotated', () => {
      const injector = createInjector([]);

      const func = function(a: any, b: any) { };

      expect(injector.annotateDependencies(func)).toEqual(['a', 'b']);
    });

    it('strips comments from argument lists when parsing', () => {
      const injector = createInjector([]);

      const func = function(a: any, /* b, */  c: any) { };

      expect(injector.annotateDependencies(func)).toEqual(['a', 'c']);
    });

    it('strips several comments from argument lists when parsing', () => {
      const injector = createInjector([]);

      const func = function(a: any, /* b, */ c: any /*, d*/) { };

      expect(injector.annotateDependencies(func)).toEqual(['a', 'c']);
    });

    it('strips // comments from argument lists when parsing', () => {
      const injector = createInjector([]);

      const func = function(
        a: any,
        //b,
        c: any) { };

      expect(injector.annotateDependencies(func)).toEqual(['a', 'c']);
    });

    it('strips surrounding underscores from argument names when parsing', () => {
      const injector = createInjector([]);

      const func = function(a: any, _b_: any, c_: any, _d: any, an_argument: any) { };

      expect(injector.annotateDependencies(func)).toEqual(['a', 'b', 'c_', '_d', 'an_argument']);
    });
  });

  it('throws when using a non-annotated function in strict mode', () => {
    const injector = createInjector([], true);

    const func = function(a: any, b: any, c: any) { };

    expect(() => injector.annotateDependencies(func)).toThrow();
  });

  it('invokes an array-annotated function with dependency injection', () => {
    const module = angular.module('myModule', []);
    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    const func = ['a', 'b', (one: number, two: number) => one + two];

    expect(injector.invoke(func)).toBe(3);
  });

  it('invokes a non-annotated function with dependency injection', () => {
    const module = angular.module('myModule', []);
    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    const func = (a: number, b: number) => a + b;

    expect(injector.invoke(func)).toBe(3);
  });

  it('instantiates an annotated constructor function', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    function Type(one: number, two: number) {
      this.result = one + two;
    }

    (<any>Type).$inject = ['a', 'b'];

    const instance = injector.instantiate(Type);
    expect(instance.result).toBe(3);
  });

  it('instantiates an array-annotated constructor function', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    function Type(one: number, two: number) {
      this.result = one + two;
    }

    const instance = injector.instantiate(['a', 'b', Type]);
    expect(instance.result).toBe(3);
  });

  it('instantiates a non--annotated constructor function', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    function Type(a: number, b: number) {
      this.result = a + b;
    }

    const instance = injector.instantiate(Type);
    expect(instance.result).toBe(3);
  });

  it('uses the prototype of the constructor when instantiating', () => {
    function BaseType() { }
    BaseType.prototype.getValue = function() { return 42; };

    function Type() { this.v = this.getValue(); }
    Type.prototype = BaseType.prototype;

    const module = angular.module('myModule', []);
    const injector = createInjector(['myModule']);

    const instance = injector.instantiate(Type);
    expect(instance.v).toBe(42);
  });

  it('supports locals when instantiating', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);
    module.constant('b', 2);

    const injector = createInjector(['myModule']);

    function Type(a: number, b: number) {
      this.result = a + b;
    }

    const instance = injector.instantiate(Type, { b: 3 });

    expect(instance.result).toBe(4);
  });

  it('allows registering a provider and uses its $get', () => {
    const module = angular.module('myModule', []);

    module.provider('a', {
      $get: function() {
        return 42;
      }
    });

    const injector = createInjector(['myModule']);

    expect(injector.has('a')).toBe(true);
    expect(injector.get('a')).toBe(42);
  });

  it('injects the $get method of a provider', () => {
    const module = angular.module('myModule', []);
    module.constant('a', 1);
    module.provider('b', {
      $get: function(a: number) {
        return a + 2;
      }
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('b')).toBe(3);
  });

  it('injects the $get method of a provider lazilly', () => {
    const module = angular.module('myModule', []);

    module.provider('b', {
      $get: function(a: number) {
        return a + 2;
      }
    });

    module.provider('a', {
      $get: function() {
        return 40;
      }
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('b')).toBe(42);
  });

  it('instantiates a dependency only once', () => {
    const module = angular.module('myModule', []);
    module.provider('a', {
      $get: function () {
        return {};
      }
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(injector.get('a'));
  });

  it('notifies the user about a circular dependency', () => {
    const module = angular.module('myModule', []);

    module.provider('a', {
      $get: function(b: any) { }
    });

    module.provider('b', {
      $get: function(c: any) { }
    });

    module.provider('c', {
      $get: function(a: any) { }
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('a'))
      .toThrowError('Injector.getValue: Circular dependency identified');
  });
});
