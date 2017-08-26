'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { Scope } from '../src/scope';
import { createInjector } from '../src/injector';
import {
  $CompileProvider,
  $CompileService,
  DirectiveFactory,
  IDirectiveFactoryObject,
  Attributes
} from '../src/compile';
import { $ControllerProvider } from '../src/controller';
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
            compile: (element) => {
              element.data('hasCompiled', true)
            },
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
          compile: (element) => {
            element.data('hasCompiled', true)
          },
          restrict: 'EACM'
        };
      },
      mySecondDirective: () => {
        return {
          compile: (element) => {
            element.data('secondCompiled', true)
          },
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
            compile: (element, attrs) => {
              attrs1 = attrs;
            }
          }
        },
        myOtherDir: () => {
          return {
            compile: (element, attrs) => {
              attrs2 = attrs;
            }
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

    it('calls observer immediately when attribute is $set', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive some-attribute="42"></my-directive>',
        (element, attrs) => {
          let gotValue: any;
          attrs.$observe('someAttribute', (value: any) => gotValue = value);

          attrs.$set('someAttribute', 43);

          expect(gotValue).toBe(43);
        });
    });

    it('calls observer on next $digest after registration', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive some-attribute="42"></my-directive>',
        (element, attrs, $rootScope) => {
          let gotValue: any;
          attrs.$observe('someAttribute', (value: any) => gotValue = value);

          $rootScope.$digest();

          expect(gotValue).toBe('42');
        });
    });

    it('lets observers be deregistered', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive some-attribute="42"></my-directive>',
        (element, attrs) => {
          let gotValue: any;

          const remove = attrs.$observe('someAttribute', (value) => {
            gotValue = value
          });

          attrs.$set('someAttribute', '43');
          expect(gotValue).toBe('43');

          remove();
          attrs.$set('someAttribute', '44');
          expect(gotValue).toBe('43');
        });
    });

    it('adds an attribute from a class directive', () => {
      registerAndCompile(
        'myDirective',
        '<div class="my-directive"></div>',
        (element, attrs) => {
          expect(attrs.hasOwnProperty('myDirective')).toBe(true);
        });
    });

    it('does not add attribute for class without a directive', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive class="some-class"></my-directive>',
        (element, attrs) => {
          expect(attrs.hasOwnProperty('someClass')).toBe(false);
        });
    });

    it('supports values for class directive attributes', () => {
      registerAndCompile(
        'myDirective',
        '<div class="my-directive: my attribute value"></div>',
        (element, attrs) => {
          expect((<any>attrs).myDirective).toBe('my attribute value');
        });
    });

    it('terminates class directive attribute value at semicolon', () => {
      registerAndCompile(
        'myDirective',
        '<div class="my-directive: my attribute value; some-other-class"></div',
        (element, attrs) => {
          expect((<any>attrs).myDirective).toEqual('my attribute value');
        });
    });

    it('adds an attribute with a value from a comment directive', () => {
      registerAndCompile(
        'myDirective',
        '<!-- directive: my-directive and the attribute value -->',
        (element, attrs) => {
          expect(attrs.hasOwnProperty('myDirective')).toBe(true);
          expect((<any>attrs).myDirective).toEqual('and the attribute value');
        });
    });

    it('allows adding classes', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive></my-directive>',
        (element, attrs) => {
          attrs.$addClass('some-class');
          expect(element.hasClass('some-class')).toBe(true);
        });
    });

    it('allows removing classes', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive class="some-class"></my-directive>',
        (element, attrs) => {
          attrs.$removeClass('some-class');
          expect(element.hasClass('some-class')).toBe(false);
        });
    });

    it('allows updating classes', () => {
      registerAndCompile(
        'myDirective',
        '<my-directive class="one three four"></my-directive>',
        (element, attrs) => {
          attrs.$updateClass('one two three', 'one three four');
          expect(element.hasClass('one')).toBe(true);
          expect(element.hasClass('two')).toBe(true);
          expect(element.hasClass('three')).toBe(true);
          expect(element.hasClass('four')).toBe(false);
        });
    });
  });

  it('returns a public link function from compile', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: _.noop
      };
    });

    injector.invoke(($compile: $CompileService) => {
      const el = $('<div my-directive></div>');
      const linkFn = $compile.compile(el);
      expect(linkFn).toBeDefined();
      expect(typeof linkFn === 'function').toBe(true);
    });
  });

  it('supports link function in DDO', () => {
    let givenScope: Scope;
    let givenElement: JQuery;
    let givenAttrs: Attributes;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: (scope: Scope, element: JQuery, attrs: Attributes) => {
          givenScope = scope;
          givenElement = element;
          givenAttrs = attrs;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);

      expect(givenScope).toBe($rootScope);
      expect(givenElement[0]).toBe(el[0]);
      expect(givenAttrs).toBeDefined();
      expect((<any>givenAttrs).myDirective).toBeDefined();
    });
  });

  it('links directive on child elements first', () => {
    const givenElements: JQuery[] = [];

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: (scope, element, attrs) => {
          givenElements.push(element);
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive><div my-directive></div></div>');

      $compile.compile(el)($rootScope);

      expect(givenElements.length).toBe(2);
      expect(givenElements[0][0]).toBe((<HTMLElement>el[0].firstChild));
      expect(givenElements[1][0]).toBe(el[0]);
    });
  });
});

describe('linking', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;
    publishExternalAPI();

    angular = (<any>window).angular;
  });

  it('takes a scope and attaches it to elements', () => {
    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: _.noop
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);
      expect(el.data('$scope')).toBe($rootScope);
    });
  });

  it('calls directive link function with scope', () => {
    let givenScope: Scope;
    let givenElement: JQuery;
    let givenAttrs: Attributes;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        compile: () => {
          return (scope, element, attrs) => {
            givenScope = scope;
            givenElement = element;
            givenAttrs = attrs;
          };
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);

      expect(givenScope).toBe($rootScope);
      expect(givenElement[0]).toBe(el[0]);
      expect(givenAttrs).toBeDefined();
      expect((<any>givenAttrs).myDirective).toBeDefined();
    });
  });

  it('links children when parent has no directives', () => {
    const givenElements: JQuery[] = [];

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: (scope: Scope, element: JQuery, attrs: Attributes) => {
          givenElements.push(element);
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div><div my-directive></div></div>');

      $compile.compile(el)($rootScope);

      expect(givenElements.length).toBe(1);
      expect(givenElements[0][0]).toBe((<HTMLElement>el[0].firstChild))
    });
  });

  it('supports link function objects', () => {
    let linked = false;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: {
          post: (scope, element, attrs) => {
            linked = true;
          }
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div><div my-directive></div></div>');

      $compile.compile(el)($rootScope);
      expect(linked).toBe(true);
    });
  });

  it('supports prelinking and postlinking', () => {
    const linkings: any[] = [];

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: {
          pre: (scope, element) => {
            linkings.push(['pre', element[0]]);
          },
          post: (scope, element) => {
            linkings.push(['post', element[0]]);
          }
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive><div my-directive></div></div>');

      $compile.compile(el)($rootScope);
      expect(linkings.length).toBe(4);
      expect(linkings[0]).toEqual(['pre', el[0]]);
      expect(linkings[1]).toEqual(['pre', el[0].firstChild]);
      expect(linkings[2]).toEqual(['post', el[0].firstChild]);
      expect(linkings[3]).toEqual(['post', el[0]]);
    });
  });

  it('reverses priority for postlink functions', () => {
    const linkings: any[] = [];

    const injector = makeInjectorWithDirectives({
      firstDirective: () => {
        return {
          priority: 2,
          link: {
            pre: (scope, element) => {
              linkings.push('first-pre');
            },
            post: (scope, element) => {
              linkings.push('first-post');
            }
          }
        };
      },
      secondDirective: () => {
        return {
          priority: 1,
          link: {
            pre: (scope, element) => {
              linkings.push('second-pre');
            },
            post: (scope, element) => {
              linkings.push('second-post');
            }
          }
        };
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div first-directive second-directive></div>');

      $compile.compile(el)($rootScope);
      expect(linkings).toEqual([
        'first-pre',
        'second-pre',
        'second-post',
        'first-post'
      ]);
    });
  });

  it('stabilizes the node list during linking', () => {
    const givenElements: Node[] = [];

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        link: (scope, element, attrs) => {
          givenElements.push(element[0]);
          element.after('<div></div>');
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div><div my-directive></div><div my-directive></div></div>');

      const el1 = el[0].childNodes[0];
      const el2 = el[0].childNodes[1];

      $compile.compile(el)($rootScope);
      expect(givenElements.length).toBe(2);
      expect(givenElements[0]).toBe(el1);
      expect(givenElements[1]).toBe(el2);
    });
  });

  it('invokes multi-element directive link functions with whole group', () => {
    let givenElements: JQuery;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        multiElement: true,
        link: (scope, element, attrs) => {
          givenElements = element;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $(
        '<div my-directive-start></div>'
        + '<p></p>'
        + '<div my-directive-end></div>');

      $compile.compile(el)($rootScope);
      expect(givenElements.length).toBe(3);
    });
  });

  it('makes a new scope for element when the directive asks for it', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: true,
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);
      expect(givenScope.$parent).toBe($rootScope);
    });
  });

  it('gives inherited scope to all directives on element', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          scope: true
        };
      },
      myOtherDirective: () => {
        return {
          link: (scope) => {
            givenScope = scope;
          }
        };
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-other-directive></div>');

      $compile.compile(el)($rootScope);

      expect(givenScope.$parent).toBe($rootScope);
    });
  });

  it('adds scope class and data for element with new scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: true,
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');

      $compile.compile(el)($rootScope);

      expect(el.hasClass('ng-scope')).toBe(true);
      expect(el.data('$scope')).toBe(givenScope);
    });
  });

  it('creates an isolate scope when requested', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {},
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);

      expect(givenScope.$parent).toBe($rootScope);
      expect(Object.getPrototypeOf(givenScope)).not.toBe($rootScope);
    });
  });

  it('does not share isolate scope with other directives', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          scope: {}
        };
      },
      myOtherDirective: () => {
        return {
          link: (scope) => {
            givenScope = scope;
          }
        };
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-other-directive></div>');
      $compile.compile(el)($rootScope);
      expect(givenScope).toBe($rootScope);
    });
  });

  it('does not use isolate scope on child elements', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          scope: {}
        };
      },
      myOtherDirective: () => {
        return {
          link: (scope) => {
            givenScope = scope;
          }
        }
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive><div my-other-directive></div></div>');

      $compile.compile(el)($rootScope);

      expect(givenScope).toBe($rootScope);
    });
  });

  it('does not allow two isolate scope directives on an element', () => {
    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          scope: {}
        };
      },
      myOtherDirective: () => {
        return {
          scope: {}
        };
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-other-directive></div>');

      expect(() => {
        $compile.compile(el);
      }).toThrow();
    });
  });

  it('does not allow both isolate and inherited scopes on an element', () => {
    const injector = makeInjectorWithDirectives({
      myDirective: () => {
        return {
          scope: {}
        };
      },
      myOtherDirective: () => {
        return {
          scope: true
        };
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-other-directive></div>');

      expect(() => $compile.compile(el)).toThrow();
    });
  });

  it('adds class and data for element with isolate scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {},
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);

      expect(el.hasClass('ng-isolate-scope')).toBe(true);
      expect(el.hasClass('ng-scope')).toBe(false);
      expect(el.data('$isolateScope')).toBe(givenScope);
    });
  });

  it('allows observing attributes in the isolate scope', () => {
    let givenScope: Scope;
    let givenAttrs: Attributes;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          anAttr: '@'
        },
        link: (scope, element, attrs) => {
          givenScope = scope;
          givenAttrs = attrs;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);

      givenAttrs.$set('anAttr', '42');
      expect((<any>givenScope).anAttr).toBe('42');
    });
  });

  it('allows aliasing observed attribute', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          aScopeAttr: '@anAttr'
        },
        link: (scope, element, attrs) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive an-attr="42"></div>');
      $compile.compile(el)($rootScope);

      expect((<any>givenScope).aScopeAttr).toBe('42');
    });
  });

  it('allows binding expression to isolate scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          anAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive an-attr="42"></div>');
      $compile.compile(el)($rootScope);

      expect((<any>givenScope).anAttr).toBe(42);
    });
  });

  it('allows aliasing expression attribute on isolate scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '=theAttr'
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive the-attr="42"></div>');
      $compile.compile(el)($rootScope);

      expect((<any>givenScope).myAttr).toBe(42);
    });
  });

  it('evaluates isolate scope expression on parent scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      (<any>$rootScope).parentAttr = 41;
      const el  = $('<div my-directive my-attr="parentAttr + 1"></div>');
      $compile.compile(el)($rootScope);

      expect((<any>givenScope).myAttr).toBe(42);
    });
  });

  it('watches isolated scope expressions', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-attr="parentAttr + 1"></div>');
      $compile.compile(el)($rootScope);

      (<any>$rootScope).parentAttr = 41;

      $rootScope.$digest();

      expect((<any>givenScope).myAttr).toBe(42);
    });
  });

  it('allows assigning to isolated scope expressions', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-attr="parentAttr"></div>');
      $compile.compile(el)($rootScope);

      (<any>givenScope).myAttr = 42;

      $rootScope.$digest();

      expect((<any>$rootScope).parentAttr).toBe(42);
    });
  });

  it('gives parent change precedence when both parent and child change', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive my-attr="parentAttr"></div>');
      $compile.compile(el)($rootScope);

      (<any>$rootScope).parentAttr = 42;

      (<any>givenScope).myAttr = 43;

      $rootScope.$digest();

      expect((<any>$rootScope).parentAttr).toBe(42);
      expect((<any>givenScope).myAttr).toBe(42);
    });
  });

  it('throws when isolate scope expression returns new arrays', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '='
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      (<any>$rootScope).parentFunction = () => {
        return [1, 2, 3];
      };

      const el = $('<div my-directive my-attr="parentFunction()"></div>');

      $compile.compile(el)($rootScope);

      expect(() => $rootScope.$digest()).toThrow();
    });
  });

  it('can watch isolated scope expressions as collections', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '=*'
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      (<any>$rootScope).parentFunction = () => [1, 2, 3];

      const el = $('<div my-directive my-attr="parentFunction()"></div>');

      $compile.compile(el)($rootScope);

      $rootScope.$digest();

      expect((<any>givenScope).myAttr).toEqual([1, 2, 3]);
    });
  });

  it('does not watch optional missing isolate scope expressions', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myAttr: '=?'
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div my-directive></div>');
      $compile.compile(el)($rootScope);
      expect($rootScope.$$watchers.length).toBe(0);
    });
  });

  it('allows binding an invokable expression on the parent scope', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myExpr: '&'
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      (<any>$rootScope).parentFunction = () => 42;

      const el = $('<div my-directive my-expr="parentFunction() + 1"></div>');

      $compile.compile(el)($rootScope);

      expect((<any>givenScope).myExpr()).toBe(43);
    });
  });

  it('allows passing arguments to parent scope expression', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myExpr: '&'
        },
        link: (scope) => {
          givenScope = scope;
        }
      };
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      let gotNum: number;

      (<any>$rootScope).parentFunction = (num: number) => {
        gotNum = num;
      };

      const el = $('<div my-directive my-expr="parentFunction(numFromChild)"></div>');

      $compile.compile(el)($rootScope);
      (<any>givenScope).myExpr({ numFromChild: 42 });

      expect(gotNum).toBe(42);
    });
  });

  it('sets missing optional parent scope expression to undefined', () => {
    let givenScope: Scope;

    const injector = makeInjectorWithDirectives('myDirective', () => {
      return {
        scope: {
          myExpr: '&?'
        },
        link: (scope) => {
          givenScope = scope;
        }
      }
    });

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      let gotArg: any;

      (<any>$rootScope).parentFunction = (arg: any) => {
        gotArg = arg;
      };

      const el = $('<div my-directive></div>');

      $compile.compile(el)($rootScope);

      expect((<any>givenScope).myExpr).toBeUndefined();
    });
  });

  describe('controllers', () => {
    it('can be attached to directives as functions', () => {
      let controllerInvoked = false;

      const injector = makeInjectorWithDirectives('myDirective', () => {
        return {
          controller: function MyController() {
            controllerInvoked = true;
          }
        };
      });

      injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
        const el = $('<div my-directive></div>');
        $compile.compile(el)($rootScope);

        expect(controllerInvoked).toBe(true);
      });
    });

    it('can be attached to directives as string references', () => {
      let controllerInvoked = false;

      function MyController() {
        controllerInvoked = true;
      }

      const injector = createInjector([
        'ng',
        function($controllerProvider: $ControllerProvider, $compileProvider: $CompileProvider) {
          $controllerProvider.register('MyController', MyController);

          $compileProvider.directive('myDirective', () => {
            return { controller: 'MyController' };
          });
        }]);

      injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
        const el = $('<div my-directive></div>');

        $compile.compile(el)($rootScope);

        expect(controllerInvoked).toBe(true);
      });
    });

    it('can be applied in the same element independent of each other', () => {
      let controllerInvoked = false;
      let otherControllerInvoked = false;

      function MyController() {
        controllerInvoked = true;
      }

      function MyOtherController() {
        otherControllerInvoked = true;
      }

      const injector = createInjector([
        'ng',
        function($controllerProvider: $ControllerProvider, $compileProvider: $CompileProvider) {
          $controllerProvider.register('MyController', MyController);
          $controllerProvider.register('MyOtherController', MyOtherController);

          $compileProvider.directive('myDirective', () => {
            return {
              controller: 'MyController'
            };
          });

          $compileProvider.directive('myOtherDirective', () => {
            return {
              controller: 'MyOtherController'
            };
          });
        }]);

      injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
        const el = $('<div my-directive my-other-directive></div>');
        $compile.compile(el)($rootScope);

        expect(controllerInvoked).toBe(true);
        expect(otherControllerInvoked).toBe(true);
      });
    });

    it('can be applied to different directives as different instances', () => {
      let invocations = 0;

      function MyController() {
        invocations++;
      }

      const injector = createInjector([
        'ng',
        function($controllerProvider: $ControllerProvider, $compileProvider: $CompileProvider) {
          $controllerProvider.register('MyController', MyController);
          $compileProvider.directive('myDirective', function() {
            return {
              controller: 'MyController'
            };
          });

          $compileProvider.directive('myOtherDirective', function() {
            return {
              controller: 'MyController'
            }
          });
        }]);

      injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
        const el = $('<div my-directive my-other-directive></div>');

        $compile.compile(el)($rootScope);

        expect(invocations).toBe(2);
      });
    });

   it('can be aliased with @ when given in directive attribute', () => {
     let controllerInvoked = false;

     function MyController() {
       controllerInvoked = true;
     }

     const injector = createInjector(['ng', function($controllerProvider: $ControllerProvider, $compileProvider: $CompileProvider) {
       $controllerProvider.register('MyController', MyController);
       $compileProvider.directive('myDirective', () => {
         return {
           controller: '@'
         };
       });
     }]);

     injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
       const el = $('<div my-directive="MyController"></div>');

       $compile.compile(el)($rootScope);
       expect(controllerInvoked).toBe(true);
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
  cb: (element: JQuery, attrs: Attributes, $rootScope: Scope) => any) {

  let givenAttrs: Attributes;
  const injector = makeInjectorWithDirectives(direName, function() {
    return {
      restrict: 'EACM',
      compile: (element, attrs) => {
        givenAttrs = attrs;
      }
    }
  });

  injector.invoke(function($compile: $CompileService, $rootScope: Scope) {
    const el = $(domString);
    $compile.compile(el);
    cb(el, givenAttrs, $rootScope);
  });;
}
