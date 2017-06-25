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
});
