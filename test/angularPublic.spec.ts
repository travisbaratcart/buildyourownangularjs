'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector } from '../src/injector';

describe('angularPublic', () => {
  it('sets up the angular object and the module loader', () => {
    publishExternalAPI();

    expect((<any>window).angular).toBeDefined();
    expect((<any>window).angular.module).toBeDefined();
  });

  it('sets up the ng module', () => {
    publishExternalAPI();

    expect(createInjector(['ng'])).toBeDefined();
  });

  it('sets up the $filter service', () => {
    publishExternalAPI();

    const injector = createInjector(['ng']);

    expect(injector.has('$filter')).toBe(true);
  });

  it('sets up the $parse service', () => {
    publishExternalAPI();

    const injector = createInjector(['ng']);

    expect(injector.has('$parse')).toBe(true);
  });

  it('sets up the $rootScope', () => {
    publishExternalAPI();

    const injector = createInjector(['ng']);

    expect(injector.has('$rootScope')).toBe(true);
  });

  it('sets up $q', () => {
    publishExternalAPI();

    const injector = createInjector(['ng']);

    expect(injector.has('$q')).toBe(true);
  });
});
