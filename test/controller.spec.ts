'use strict';
import { Angular } from '../src/loader';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector, IProvide } from '../src/injector';
import { $ControllerService, $ControllerProvider } from '../src/controller';

describe('$controller', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;
    publishExternalAPI();

    angular = (<any>window).angular;
  })

  it('instantiates controller functions', () => {
    const injector = createInjector(['ng']);
    const $controller: $ControllerService = injector.get('$controller');

    function MyController() {
      this.invoked = true;
    }

    const controller = $controller.controller(MyController);

    expect(controller).toBeDefined();
    expect(controller instanceof MyController).toBe(true);
    expect(controller.invoked).toBe(true);
  });

  it('injects dependencies to controller functions', () => {
    const injector = createInjector(['ng', ($provide: IProvide) => {
      $provide.constant('aDep', 42);
    }]);

    const $controller = injector.get('$controller');

    function MyController(aDep: number) {
      this.theDep = aDep;
    }

    const controller = $controller.controller(MyController);

    expect(controller.theDep).toBe(42);
  });

  it('allows injecting locals to controller functions', () => {
    const injector = createInjector(['ng']);
    const $controller: $ControllerService = injector.get('$controller');

    function MyController(aDep: any) {
      this.theDep = aDep;
    }

    const controller = $controller.controller(MyController, { aDep: 42 });

    expect(controller.theDep).toBe(42);
  });

  it('allows registering controllers at config time', () => {
    function MyController() {

    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register('MyController', MyController);
    }]);

    const $controller: $ControllerService = injector.get('$controller');

    const controller = $controller.controller('MyController');

    expect(controller).toBeDefined();
    expect(controller instanceof MyController).toBe(true);
  });

  it('allows registering several controllers in an object', () => {
    function MyController() {

    }

    function MyOtherController() {

    }

    const injector = createInjector(['ng', ($controllerProvider: $ControllerProvider) => {
      $controllerProvider.register({
        MyController,
        MyOtherController
      });
    }]);

    const $controller: $ControllerService = injector.get('$controller');

    const controller = $controller.controller('MyController');
    const otherController = $controller.controller('MyOtherController');

    expect(controller instanceof MyController).toBe(true);
    expect(otherController instanceof MyOtherController).toBe(true);
  });

  it('allows registering controllers through modules', () => {
    const module = angular.module('myModule', []);

    module.controller('MyController', function MyController() { });

    const injector = createInjector(['ng', 'myModule']);

    const $controller: $ControllerService = injector.get('$controller');
    const controller = $controller.controller('MyController');

    expect(controller).toBeDefined();
  });
});
