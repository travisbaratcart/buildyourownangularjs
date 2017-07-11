'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { createInjector } from '../src/injector';
import {
  $CompileProvider,
  $CompileService,
  DirectiveFactory,
  IDirectiveFactoryObject
} from '../src/compile';
import * as _ from 'lodash';

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

  it('compiles element directives from child elements', () => {
    let directiveNumber = 1;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element: JQuery) => {
          element.data('hasCompiled', directiveNumber++);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div><my-directive></my-directive></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBeUndefined();
      expect(el.find('> my-directive').data('hasCompiled')).toBe(1);
    });
  });

  it('compiles nested directives', () => {
    let directiveNumber = 1;

    const injector = makeInjectorWithDirectives('myDir', () => {
      return {
        compile: (element: JQuery) => {
          element.data('hasCompiled', directiveNumber++);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<my-dir><my-dir><my-dir></my-dir></my-dir></my-dir>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(1);
      expect(el.find('> my-dir').data('hasCompiled')).toBe(2);
      expect(el.find('> my-dir > my-dir').data('hasCompiled')).toBe(3);
    });
  });

  _.forEach(['x', 'data'], (prefix) => {
    _.forEach([':', '-', '-'], delimeter => {
      it(`compiles element directives with ${prefix} prefix and ${delimeter} delimeter`, () => {
        const injector = makeInjectorWithDirectives('myDir', () => {
          return {
            compile: (element) => element.data('hasCompiled', true)
          };
        });

        injector.invoke(function($compile: $CompileService) {
          const el = $(`<${prefix}${delimeter}my-dir></${prefix}${delimeter}my-dir>`);

          $compile.compile(el);

          expect(el.data('hasCompiled')).toBe(true);
        });
      });
    });
  });

  it('compiles attribute directives', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div my-directive></div');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles attribute directives with prefixes', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        }
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div x:my-directive></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles several attribute directives in an element', () => {
    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          compile: (element) => element.data('hasCompiled', true)
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => element.data('secondCompiled', true)
        }
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div my-directive my-second-directive></div>');

      $compile.compile(el);

      expect(el.data('hasCompiled')).toBe(true);
      expect(el.data('secondCompiled')).toBe(true);
    });
  });

  it('compiles both element and attribute directives in an element', () => {
    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          compile: (element) => {
            element.data('hasCompiled', true);
          }
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => {
            element.data('secondCompiled', true);
          }
        }
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const element = $('<my-directive my-second-directive></my-directive>');
      $compile.compile(element);
      expect(element.data('hasCompiled')).toBe(true);
      expect(element.data('secondCompiled')).toBe(true);
    });
  });

  it('compiles attribute directives with ng-attr prefix', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div ng-attr-my-directive></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles attribute directives with data:ng-attr prefix', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div data:ng-attr-my-directive></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });
});

function makeInjectorWithDirectives(directiveNameOrObject: string | IDirectiveFactoryObject, directiveFactory?: DirectiveFactory) {
  return createInjector(['ng', function($compileProvider: $CompileProvider) {
    $compileProvider.directive(directiveNameOrObject, directiveFactory);
  }]);
}
