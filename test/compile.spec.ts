'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { createInjector } from '../src/injector';

describe('$compile', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;
    publishExternalAPI();

    angular = (<any>window).angular;
  });

  it('allows creating directives', () => {
    const myModule = angular.module('myModule', []);
    myModule.directive('testing', function() { return {}; });
    const injector = createInjector(['ng', 'myModule']);
    expect(injector.has('testingDirective')).toBe(true);
  });

  it('allows creating many directives with the same name', () => {
    const myModule = angular.module('myModule', []);
    myModule.directive('testing', () => {
      return {
        d: 'one'
      };
    });

    myModule.directive('testing', () => {
      return {
        d: 'two'
      };
    });

    const injector = createInjector(['ng', 'myModule']);
    const result = injector.get('testingDirective');

    expect(result.length).toBe(2);
    expect(result[0].d).toEqual('one');
    expect(result[1].d).toEqual('two');
  });

  it('allows creating directives with object notation', () => {
    const myModule = angular.module('myModule', []);

    myModule.directive({
      a: () => { return {}; },
      b: () => { return {}; },
      c: () => { return {}; }
    });

    const injector = createInjector(['ng', 'myModule']);

    expect(injector.has('aDirective')).toBe(true);
    expect(injector.has('bDirective')).toBe(true);
    expect(injector.has('cDirective')).toBe(true);
  });
});
