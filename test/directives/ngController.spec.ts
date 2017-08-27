'use strict';
import { Angular } from '../../src/loader';
import { publishExternalAPI } from '../../src/angularPublic';
import { createInjector } from '../../src/injector';
import { $ControllerProvider } from '../../src/controller';
import { $CompileService, Attributes } from '../../src/compile';
import { Scope } from '../../src/scope';

describe('ngController', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;
    publishExternalAPI();
    angular = (<any>window).angular;
  });

  it('is instantiated during compilation and linking', () => {
    let instantiated = false;

    function MyController() {
      instantiated = true;
    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register('MyController', MyController);
    }]);

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div ng-controller="MyController"></div>');

      $compile.compile(el)($rootScope);
      expect(instantiated).toBe(true);
    });
  });

  it('may inject scope, element, and attrs', () => {
    let gotScope: Scope;
    let gotAttrs: Attributes;
    let gotElement: JQuery;

    function MyController($scope: Scope, $element: JQuery, $attrs: Attributes) {
      gotScope = $scope;
      gotElement = $element;
      gotAttrs = $attrs;
    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register('MyController', MyController);
    }]);

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div ng-controller="MyController"></div>');

      $compile.compile(el)($rootScope);

      expect(gotScope).toBeDefined();
      expect(gotElement).toBeDefined();
      expect(gotAttrs).toBeDefined();
    });
  })

  it('has an inherited scope', () => {
    let gotScope: Scope;

    function MyController($scope: Scope, $element: JQuery, $attrs: Attributes) {
      gotScope = $scope;
    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register('MyController', MyController);
    }]);

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div ng-controller="MyController"></div>');
      $compile.compile(el)($rootScope);

      expect(gotScope).not.toBe($rootScope);
      expect(gotScope.$parent).toBe($rootScope);
      expect(Object.getPrototypeOf(gotScope)).toBe($rootScope);
    });
  });

  it('allows aliasing controller in expression', () => {
    let gotScope: Scope;

    function MyController($scope: Scope) {
      gotScope = $scope;
    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register('MyController', MyController);
    }]);

    injector.invoke(($compile: $CompileService, $rootScope: Scope) => {
      const el = $('<div ng-controller="MyController as myCtrl"</div>');
      $compile.compile(el)($rootScope);

      expect((<any>gotScope).myCtrl instanceof MyController).toBe(true);
    });
  });
});
