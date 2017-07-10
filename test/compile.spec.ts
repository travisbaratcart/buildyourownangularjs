'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { createInjector } from '../src/injector';
import { $CompileProvider, $CompileService, DirectiveFactory } from '../src/compile';

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

  it('compiles element directives from a single element', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<my-directive></my-directive>');

      $compile.compile(el);

      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles element directives found from several elements', () => {
    let directiveNumber = 1;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('directiveNumber', directiveNumber++);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<my-directive></my-directive><my-directive></my-directive>');

      $compile.compile(el);

      expect(el.eq(0).data('directiveNumber')).toBe(1);
      expect(el.eq(1).data('directiveNumber')).toBe(2);
    });
  });
});

function makeInjectorWithDirectives(directiveName: string, directiveFactory: DirectiveFactory) {
  return createInjector(['ng', function($compileProvider: $CompileProvider) {
    $compileProvider.directive(directiveName, directiveFactory);
  }]);
}
