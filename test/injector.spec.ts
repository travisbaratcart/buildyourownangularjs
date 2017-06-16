'use strict';
import { setupModuleLoder, Angular } from '../src/loader';
import { createInjector } from '../src/injector';


describe('injector', () => {
  beforeEach(() => {
    delete (<any>window).angular;

    setupModuleLoder(window);
  });

  it('can be created', () => {
    const injector = createInjector([]);
    expect(injector).toBeDefined();
  });

  it('has a constant that has been registered to a module', () => {
    const module = (<any>window).angular.module('myModule', []);
    module.constant('aConstant', 42);

    const injector = createInjector(['myModule']);
    expect(injector.has('aConstant')).toBe(true);
  });

  it('does not have a non-registered constant', () => {
    const module = (<any>window).angular.module('myModule', []);
    const injector = createInjector(['myModule']);

    expect(injector.has('aConstant')).toBe(false);
  });
});
