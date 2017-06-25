'use strict';
import { setupModuleLoader, Angular } from '../src/loader';
import { createInjector, Injector, IProvide } from '../src/injector';

describe('injector', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;

    setupModuleLoader(window);

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
      .toThrowError('InternalInjector.getValue: Circular dependency identified. a <- c <- b <- a');
  });

  it('cleans up the circular marker when instantiation fails', () => {
    const module = angular.module('myModule', []);

    module.provider('a', {
      $get: function() {
        throw new Error('Failing instantiation');
      }
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('a'))
      .toThrowError('Failing instantiation');

    expect(() => injector.get('a'))
      .toThrowError('Failing instantiation');
  });

  it('instantiates a provider if given a constructor function', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function () {
      this.$get = function() { return 42; };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('injects the given provider constructor function', () => {
    const module = angular.module('myModule', []);

    module.constant('b', 2);

    module.provider('a', function(b: number) {
      this.$get = function() { return 1 + b; };
    });

    const injector = createInjector(['myModule']);
    expect(injector.get('a')).toBe(3);
  });

  it('injects another provider to a provider constructor function', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      let value = 1;
      this.setValue = function(val: any) { value = val; };
      this.$get = function() { return value; };
    });

    module.provider('b', function BProvider(aProvider: any) {
      aProvider.setValue(2);
      this.$get = function() { };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(2);
  });

  it('does not inject an instance to a provider constructor function', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function () {
      this.$get = function() { return 1; };
    });

    module.provider('b', function(a: any) {
      this.$get = function() { return a; };
    });

    expect(() => createInjector(['myModule'])).toThrow();
  });

  it('does not inject a provider to a $get function', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      this.$get = function() { return 1; };
    });

    module.provider('b', function() {
      this.$get = function(aProvider: any) { return aProvider.$get(); };
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('b')).toThrow();
  });

  it('does not inject a provider to invoke', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      this.$get = function() { return 1; };
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.invoke(function(aProvider) { })).toThrow();
  });

  it('does not give access to providers through get', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      this.$get = function() { return 1; };
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('aProvider')).toThrow();
  });

  it('registers constants first to make them available to providers', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function(b: any) {
      this.$get = function() { return b; };
    });

    module.constant('b', 42);

    const injector = createInjector(['myModule']);
    expect(injector.get('a')).toBe(42);
  });

  it('allows injecting the instance injector to $get', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 42);
    module.provider('b', function() {
      this.$get = function($injector: Injector) {
        return $injector.get('a');
      };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('b')).toBe(42);
  });

  it('allows injecting the provider injector to provider', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      this.value = 42;
      this.$get = function() { return this.value; };
    });

    module.provider('b', function($injector: Injector) {
      const aProvider = $injector.get('aProvider');

      this.$get = function() { return aProvider.value };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('b')).toBe(42);
  });

  it('allows injecting the $provide service to providers', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function($provide: IProvide) {
      $provide.constant('b', 2);
      this.$get = function(b: number) { return b + 1; };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(3);
  });

  it('does not allow injecting the $provide service to $get', () => {
    const module = angular.module('myModule', []);

    module.provider('a', function() {
      this.$get = function($provide: IProvide) { };
    });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('a')).toThrow();
  });

  it('runs config blocks when the injector is created', () => {
    const module = angular.module('myModule', []);

    let hasRun = false;
    module.config(function() {
      hasRun = true;
    });

    createInjector(['myModule']);

    expect(hasRun).toBe(true);
  });

  it('injects config blocks with provider injector', () => {
    const module = angular.module('myModule', []);

    module.config(function($provide: IProvide) {
      $provide.constant('a', 42);
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('allow registering config blocks before providers', () => {
    const module = angular.module('myModule', []);

    module.config(function(aProvider: any) { });
    module.provider('a', function() {
      this.$get = function() { return 42; };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('runs a config block added during module registration', () => {
    const module = angular.module('myModule', [], function($provide: IProvide) {
      $provide.constant('a', 42);
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  })

  it('runs run blocks when the injector is created', () => {
    const module = angular.module('myModule', []);

    let hasRun = false;
    module.run(function() {
      hasRun = true;
    });

    createInjector(['myModule']);

    expect(hasRun).toBe(true);
  });

  it('injects run blocks with the instance injector', () => {
    const module = angular.module('myModule', []);

    module.provider('a', {
      $get: function() { return 42; }
    });

    let gotA: any;
    module.run(function(a: any) {
      gotA = a;
    });

    createInjector(['myModule']);

    expect(gotA).toBe(42);
  });

  it('configures all modules before running any run blocks', () => {
    const module1 = angular.module('myModule', []);

    module1.provider('a', {
      $get: function() { return 1; }
    });

    let result: number;
    module1.run(function(a: number, b: number) {
      result = a + b;
    });

    const module2 = angular.module('myOtherModule', []);
    module2.provider('b', {
      $get: function() {
        return 2;
      }
    });

    createInjector(['myModule', 'myOtherModule']);

    expect(result).toBe(3);
  });

  it('runs a function module dependency as a config block', () => {
    const functionModule = function($provide: IProvide) {
      $provide.constant('a', 42);
    };

    angular.module('myModule', [functionModule]);

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('runs a function module with array injection as a config block', () => {
    const functionModule = ['$provide', function($provide: IProvide) {
      $provide.constant('a', 42);
    }];

    angular.module('myModule', [functionModule]);

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('supports returning a run block from a function module', () => {
    let result: number;

    const functionModule = function($provide: IProvide) {
      $provide.constant('a', 42);
      return function(a: number) {
        result = a;
      };
    }

    angular.module('myModule', [functionModule]);

    createInjector(['myModule']);

    expect(result).toBe(42);
  });

  it('only loads function modules once', () => {
    let timesLoaded = 0;
    const functionModule = function() {
      timesLoaded++;
    };

    angular.module('myModule', [functionModule, functionModule]);

    createInjector(['myModule']);

    expect(timesLoaded).toBe(1);
  });

  it('allows registering a factory', () => {
    const module = angular.module('myModule', []);

    module.factory('a', function() { return 42; });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('injects a factory function with instances', () => {
    const module = angular.module('myModule', []);

    module.factory('a', function() { return 1; });
    module.factory('b', function(a: number) { return a + 2; });

    const injector = createInjector(['myModule']);

    expect(injector.get('b')).toBe(3);
  });

  it('only calls a factory function once', () => {
    const module = angular.module('myModule', []);

    module.factory('a', function() { return {}; });

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(injector.get('a'));
  });

  it('forces a factory to return a value', () => {
    const module = angular.module('myModule', []);

    module.factory('a', function() { });
    module.factory('b', function() { return null; });

    const injector = createInjector(['myModule']);

    expect(() => injector.get('a')).toThrow();
    expect(injector.get('b')).toBeNull();
  });

  it('allows registering a value', () => {
    const module = angular.module('myModule', []);

    module.value('a', 42);

    const injector = createInjector(['myModule']);

    expect(injector.get('a')).toBe(42);
  });

  it('does not make values available to config blocks', () => {
    const module = angular.module('myModule', []);

    module.value('a', 42);
    module.config(function(a: any) { });

    expect(() => createInjector(['myModule'])).toThrow();
  });

  it('allows an undefined value', () => {
    const module = angular.module('myModule', []);

    module.value('a', undefined);

    const injector = createInjector(['myModule']);
    expect(injector.get('a')).toBeUndefined();
  });

  it('allows registering a service', () => {
    const module = angular.module('myModule', []);

    module.service('aService', function MyService() {
      this.getValue = function() { return 42; };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aService').getValue()).toBe(42);
  });

  it('injects service constructors with instances', () => {
    const module = angular.module('myModule', []);

    module.value('theValue', 42);

    module.service('aService', function MyService(theValue: number) {
      this.getValue = function() { return theValue; };
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aService').getValue()).toBe(42);
  });

  it('only instantiates services once', () => {
    const module = angular.module('myModule', []);

    module.service('aService', function MyService() {

    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aService')).toBe(injector.get('aService'));
  });

  it('alllows changing an instance using a decorator', () => {
    const module = angular.module('myModule', []);

    module.factory('aValue', function() {
      return { aKey: 42 };
    });

    module.decorator('aValue', function($delegate: any) {
      $delegate.decoratedKey = 43;
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aValue').aKey).toBe(42);
    expect(injector.get('aValue').decoratedKey).toBe(43);
  });

  it('allows multiple decorators per service', () => {
    const module = angular.module('myModule', []);
    module.factory('aValue', function() {
      return {};
    });

    module.decorator('aValue', function($delegate: any) {
      $delegate.decoratedKey = 42;
    });

    module.decorator('aValue', function($delegate: any) {
      $delegate.anotherDecoratedKey = 43;
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aValue').decoratedKey).toBe(42);
    expect(injector.get('aValue').anotherDecoratedKey).toBe(43);
  });

  it('uses dependency injection with decorators', () => {
    const module = angular.module('myModule', []);

    module.factory('aValue', function() {
      return {};
    });

    module.constant('a', 42);

    module.decorator('aValue', function(a: number, $delegate: any) {
      $delegate.decoratedKey = a;
    });

    const injector = createInjector(['myModule']);

    expect(injector.get('aValue').decoratedKey).toBe(42);
  });
});
