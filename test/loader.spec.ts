'use strict';
import { setupModuleLoader } from '../src/loader';

describe('setupModuleLoder', () => {
  beforeEach(() => {
    delete (<any>window).angular;
  })

  it('exposes angular on the window', () => {
    setupModuleLoader(window);

    expect((<any>window).angular).toBeDefined();
  });

  it('creates angular only once', () => {
    setupModuleLoader(window);
    const ng = (<any>window).angular;
    setupModuleLoader(window);
    expect((<any>window).angular).toBe(ng);
  });

  it('exposes the angular module function', () => {
    setupModuleLoader(window);
    expect((<any>window).angular.module).toBeDefined();
  });

  describe('module', () => {
    beforeEach(() => {
      setupModuleLoader(window);
    });

    it('allows registering a module', () => {
      const myModule = (<any>window).angular.module('myModule', []);
      expect(myModule).toBeDefined();
      expect(myModule.name).toEqual('myModule');
    });

    it('replaces a module when registered with the same name again', () => {
      const myModule = (<any>window).angular.module('myModule', []);
      const myNewModule = (<any>window).angular.module('myModule', []);

      expect(myNewModule).not.toBe(myModule);
    });

    it('attaches the depenedencies array to the registered module', () => {
      const myModule = (<any>window).angular.module('myModule', ['myOtherModule']);
      expect(myModule.depenedencies).toEqual(['myOtherModule']);
    });

    it('allows getting a module', () => {
      const myModule = (<any>window).angular.module('myModule', []);
      const gotModule = (<any>window).angular.module('myModule');

      expect(gotModule).toBeDefined();
      expect(gotModule).toBe(myModule);
    });

    it('throws when trying to get a nonexistent module', () => {
      expect(() => (<any>window).angular.module('myModule')).toThrow();
    });
  });
});
