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
    myModule.directive('testing', function() { return {
      restrict: 'EACM'
    }; });
    const injector = createInjector(['ng', 'myModule']);
    expect(injector.has('testingDirective')).toBe(true);
  });

  it('allows creating many directives with the same name', () => {
    const myModule = angular.module('myModule', []);
    myModule.directive('testing', () => {
      return {
        d: 'one',
        restrict: 'EACM'
      };
    });

    myModule.directive('testing', () => {
      return {
        d: 'two',
        restrict: 'EACM'
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
      a: () => { return {
        restrict: 'EACM'
      }; },
      b: () => { return {
        restrict: 'EACM'
      }; },
      c: () => { return {
        restrict: 'EACM'
      }; }
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
        },
        restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
            compile: (element) => element.data('hasCompiled', true),
            restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
          compile: (element) => element.data('hasCompiled', true),
          restrict: 'EACM'
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => element.data('secondCompiled', true),
          restrict: 'EACM'
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
          },
          restrict: 'EACM'
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => {
            element.data('secondCompiled', true);
          },
          restrict: 'EACM'
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
        },
        restrict: 'EACM'
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
        },
        restrict: 'EACM'
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div data:ng-attr-my-directive></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles class directives', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        },
        restrict: 'EACM'
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div class="my-directive"></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles several class directives in an element', () => {
    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          compile: (element) => {
            element.data('hasCompiled', true);
          },
          restrict: 'EACM'
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => {
            element.data('secondCompiled', true);
          },
          restrict: 'EACM'
        }
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div class="my-directive my-second-directive"></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);;
      expect(el.data('secondCompiled')).toBe(true);
    });
  });

  it('compiles class directives with prefixes', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          element.data('hasCompiled', true);
        },
        restrict: 'EACM'
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div class="x-my-directive"></div>');
      $compile.compile(el);
      expect(el.data('hasCompiled')).toBe(true);
    });
  });

  it('compiles comment directives', () => {
    let hasCompiled = false;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          hasCompiled = true;
        },
        restrict: 'EACM'
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<!-- directive: my-directive -->');

      $compile.compile(el);

      expect(hasCompiled).toBe(true);
    });
  });

  _.forEach({
    E: { element: true, attribute: false, class: false, comment: false },
    A: { element: false, attribute: true, class: false, comment: false },
    C: { element: false, attribute: false, class: true, comment: false },
    M: { element: false, attribute: false, class: false, comment: true },
    EA: { element: true, attribute: true, class: false, comment: false },
    AC: { element: false, attribute: true, class: true, comment: false },
    EAM: { element: true, attribute: true, class: false, comment: true },
    EACM: { element: true, attribute: true, class: true, comment: true },
  }, (expected, restrict) => {
    describe(`restricted to ${restrict}`, () => {
      _.forEach({
        element: '<my-directive></my-directive>',
        attribute: '<div my-directive></div>',
        class: '<div class="my-directive"></div>',
        comment: '<!-- directive: my-directive -->'
      }, (node, type) => {
        it(`${(<any>expected)[type] ? 'matches': 'does not match'} on ${type}`, () => {
          let hasCompiled = false;

          const injector = makeInjectorWithDirectives('myDirective', () => {
            return {
              restrict: restrict,
              compile: (element) => {
                hasCompiled = true;
              }
            };
          });

          injector.invoke(function($compile: $CompileService) {
            const el = $(node);

            $compile.compile(el);

            expect(hasCompiled).toBe((<any>expected)[type]);
          });
        });
      });
    });
  });

  it('applies to attributes when no restrict given', () => {
    let hasCompiled = false;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          hasCompiled = true;
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div my-directive></div>');
      $compile.compile(el);
      expect(hasCompiled).toBe(true);
    });
  });

  it('applies to elements when no restrict given', () => {
    let hasCompiled = false;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          hasCompiled = true;
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<my-directive></my-directive>');
      $compile.compile(el);
      expect(hasCompiled).toBe(true);
    });
  });

  it('does not apply to classes when no restrict given', () => {
    let hasCompiled = false;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: (element) => {
          hasCompiled = true;
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div class="my-directive"></div>');
      $compile.compile(el);
      expect(hasCompiled).toBe(false);
    });
  });

  it('applies in priority order', () => {
    const compilations: string[] = [];

    const injector = makeInjectorWithDirectives({
      lowerDirective: () => {
        return {
          priority: 1,
          compile: (element) => {
            compilations.push('lower');
          }
        }
      },
      higherDirective: () => {
        return {
          priority: 2,
          compile: (element) => {
            compilations.push('higher');
          }
        }
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div lower-directive higher-directive></div>');
      $compile.compile(el);

      expect(compilations).toEqual(['higher', 'lower']);
    });
  });

  it('applies in name order when priorities are the same', () => {
    const compilations: string[] = [];

    const injector = makeInjectorWithDirectives({
      firstDirective: () => {
        return {
          priority: 1,
          compile: (element) => {
            compilations.push('first');
          }
        };
      },
      secondDirective: () => {
        return {
          priority: 1,
          compile: (element) => {
            compilations.push('second');
          }
        };
      }
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div second-directive first-directive></div>');

      $compile.compile(el);

      expect(compilations).toEqual(['first', 'second']);
    });
  });

  it('applies in registration order when names and priorities are the same', () => {
    const compilations: string[] = [];

    const myModule = angular.module('myModule', []);

    myModule.directive('aDirective', () => {
      return {
        priority: 1,
        compile: (element) => {
          compilations.push('first');
        }
      };
    });

    myModule.directive('aDirective', () => {
      return {
        priority: 1,
        compile: (element) => {
          compilations.push('second');
        }
      };
    });

    const injector = createInjector(['ng', 'myModule']);

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div a-directive></div>');

      $compile.compile(el);

      expect(compilations).toEqual(['first', 'second']);
    });
  });
});

function makeInjectorWithDirectives(directiveNameOrObject: string | IDirectiveFactoryObject, directiveFactory?: DirectiveFactory) {
  return createInjector(['ng', function($compileProvider: $CompileProvider) {
    $compileProvider.directive(directiveNameOrObject, directiveFactory);
  }]);
}
