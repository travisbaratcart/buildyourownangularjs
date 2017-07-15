'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { createInjector } from '../src/injector';
import {
  $CompileProvider,
  $CompileService,
  DirectiveFactory,
  IDirectiveFactoryObject,
  Attributes
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

  it('uses default priority when not given', () => {
    const compilations: string[] = [];

    const myModule = angular.module('myModule', []);

    myModule.directive('firstDirective', () => {
      return {
        priority: 1,
        compile: (element) => {
          compilations.push('first');
        }
      };
    });

    myModule.directive('secondDirective', () => {
      return {
        compile: (element) => {
          compilations.push('second');
        }
      };
    });

    const injector = createInjector(['ng', 'myModule']);

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div second-directive first-directive></div>');

      $compile.compile(el);

      expect(compilations).toEqual(['first', 'second']);
    });
  });

  it('stops compiling at a terminal directive', () => {
    const compilations: string[] = [];

    const myModule = angular.module('myModule', []);

    myModule.directive('firstDirective', () => {
      return {
        priority: 1,
        terminal: true,
        compile: (element) => {
          compilations.push('first');
        }
      };
    });

    myModule.directive('secondDirective', () => {
      return {
        priority: 0,
        compile: (element) => {
          compilations.push('second');
        }
      };
    });

    const injector = createInjector(['ng', 'myModule']);

    injector.instantiate(function($compile: $CompileService) {
      const el = $('<div first-directive second-directive></div>');
      $compile.compile(el);
      expect(compilations).toEqual(['first']);
    });
  });

  it('still compiles directives with same priority after terminal', () => {
    const compilations: string[] = [];

    const myModule = angular.module('myModule', []);

    myModule.directive('firstDirective', () => {
      return {
        priority: 1,
        terminal: true,
        compile: (element) => {
          compilations.push('first');
        }
      };
    });

    myModule.directive('secondDirective', () => {
      return {
        priority: 1,
        compile: (element) => {
          compilations.push('second');
        }
      };
    });

    const injector = createInjector(['ng', 'myModule']);

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div first-directive second-directive></div>');
      $compile.compile(el);
      expect(compilations).toEqual(['first', 'second']);
    });
  });

  it('stops child compilation after a terminal directive', ()=> {
    const compilations: string[] = [];

    const myModule = angular.module('myModule', []);

    myModule.directive('parentDirective', () => {
      return {
        terminal: true,
        compile: (element) => {
          compilations.push('parent');
        }
      };
    });

    myModule.directive('childDirective', () => {
      return {
        compile: (element) => {
          compilations.push('child')
        }
      };
    });

    const injector = createInjector(['ng', 'myModule']);

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div parent-directive><div child-directive></div></div>');

      $compile.compile(el);

      expect(compilations).toEqual(['parent']);
    });
  });

  it('allows applying a directive to multiple elements', () => {
    let compileEl: JQuery = null;

    const injector = makeInjectorWithDirectives('myDir', () => {
      return {
        multiElement: true,
        compile: (element) => {
          compileEl = element;
        }
      };
    });

    injector.invoke(function($compile: $CompileService) {
      const el = $('<div my-dir-start></div><span></span><div my-dir-end></div>');
      $compile.compile(el);
      expect(compileEl.length).toBe(3);
    });
  });

  describe('attributes', () => {
    it('passes the element attributes to the compile function', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive my-attr="1" my-other-attr="two"></my-directive>',
        (element, givenAttrs) => {
          expect((<any>givenAttrs).myAttr).toBe('1');
          expect((<any>givenAttrs).myOtherAttr).toBe('two');
        });
    });

    it('trims attribute values', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive my-attr=" val "></my-directive>',
        (element, givenAttrs) => {
          expect((<any>givenAttrs).myAttr).toBe('val');
        });
    });

    it('sets the value of boolean attributes to true', () => {
      registerAndCompile(
        'myDirective',
        '<input my-directive disabled>',
        (element, attrs) => {
          expect((<any>attrs).disabled).toBe(true);
        })
    });

    it('does not set the value of custom boolean attributes to true', () => {
      registerAndCompile(
        'myDirective',
        '<input my-directive somethingelse>',
        (element, attrs) => {
          expect((<any>attrs).somethingelse).toBe('');
        })
    });

    it('overrides attributes with ng-attr- versions', () => {
      registerAndCompile(
        'myDirective',
        '<input my-directive ng-attr-whatever="42" whatever="41">',
        (element, attrs) => {
          expect((<any>attrs).whatever).toBe('42');
        });
    });

    it('allows setting attributes', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive attr="true"></my-directive>',
        (element, attrs) => {
          attrs.$set('attr', 'false');
          expect((<any>attrs).attr).toEqual('false');
        });
    });

    it('sets attributes to the DOM', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive attr="true"></my-directive>',
        (element, attrs) => {
          attrs.$set('attr', 'false');
          expect(element.attr('attr')).toBe('false');
        });
    });

    it('does not set attributes to dom when flag is false', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive attr="true"></my-directive>',
        (element, attrs) => {
          attrs.$set('attr', 'false', false);
          expect(element.attr('attr')).toBe('true');
        })
    });

    it('shares attributes between directives', () => {
      let attrs1: Attributes;
      let attrs2: Attributes;

      const injector = makeInjectorWithDirectives({
        myDir: () => {
          return {
            compile: (element, attrs) => attrs1 = attrs
          }
        },
        myOtherDir: () => {
          return {
            compile: (element, attrs) => attrs2 = attrs
          }
        }
      });

      injector.invoke(($compile: $CompileService) => {
        const el = $('<div my-dir my-other-dir></div>');
        $compile.compile(el);
        expect(attrs1).toBe(attrs2);
      });
    });

    it('sets prop for boolean attributes', () => {
      registerAndCompile(
        'myDirective',
        '<input my-directive>',
        (element, attrs) => {
          attrs.$set('disabled', true);
          expect(element.prop('disabled')).toBe(true);
        });
    });

    it('sets prop for boolean attributes even when not flushing', () => {
      registerAndCompile(
        'myDirective',
        '<input my-directive>',
        (element, attrs) => {
          attrs.$set('disabled', true, false);
          expect(element.prop('disabled')).toBe(true);
        });
    });

    it('denormalizes attribute name when explicitly given', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive some-attribute="42"></my-directive>',
        (element, attrs) => {
          attrs.$set('someAttribute', 43, true, 'some-attribute');
          expect(element.attr('some-attribute')).toEqual('43');
        })
    });

    it('denormalizes attribute by snake-casing', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive some-attribute="42"></my-directive>',
        (element, attrs) => {
          attrs.$set('someAttribute', 43);
          expect(element.attr('some-attribute')).toBe('43');
        })
    });

    it('denormalizes attribute by using original attribute name', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive x-some-attribute="42"></my-directive>',
        (element, attrs) => {
          attrs.$set('someAttribute', '43');
          expect(element.attr('x-some-attribute')).toBe('43');
        });
    });

    it('does not use ng-attr- prefix in denormalized names', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive ng-attr-some-attribute="42"></my-directive>',
        (element, attrs) => {
          attrs.$set('someAttribute', 43);
          expect(element.attr('some-attribute')).toEqual('43');
        });
    });

    it('uses new attribute name after once given', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive x-some-attribute="42"></my-directive>',
        (element, attrs) => {
          attrs.$set('someAttribute', 43, true, 'some-attribute');
          attrs.$set('someAttribute', 44);

          expect(element.attr('some-attribute')).toBe('44');
          expect(element.attr('x-some-attribute')).toBe('42');
        });
    });
  });
});

function makeInjectorWithDirectives(directiveNameOrObject: string | IDirectiveFactoryObject, directiveFactory?: DirectiveFactory) {
  return createInjector(['ng', function($compileProvider: $CompileProvider) {
    $compileProvider.directive(directiveNameOrObject, directiveFactory);
  }]);
}

function registerAndCompile(
  direName: string,
  domString: string,
  cb: (element: JQuery, givenAttrs: Attributes) => any) {

  let givenAttrs: Attributes;
  const injector = makeInjectorWithDirectives(direName, function() {
    return {
      restrict: 'EACM',
      compile: (element, attrs) => {
        givenAttrs = attrs;
      }
    }
  });

  injector.invoke(function($compile: $CompileService) {
    const el = $(domString);
    $compile.compile(el);
    cb(el, givenAttrs);
  });;
}
