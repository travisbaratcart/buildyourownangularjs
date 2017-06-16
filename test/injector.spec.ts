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

    const fn = (one: number, two: number) => one + two;

    (<any>fn).$inject = ['a', 'b'];

    expect(injector.invoke(fn)).toBe(3);
  });

  it('does not accept non-strings as injection tokens', () => {
    const module = angular.module('myModule', []);

    module.constant('a', 1);

    const injector = createInjector(['myModule']);

    const func = (one: number, two: number) => one + two;

    (<any>func).$inject = ['a', 2];

    expect(() => injector.invoke(func)).toThrow();
  });
});
