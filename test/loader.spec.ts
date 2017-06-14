'use strict';
import { setupModuleLoder } from '../src/loader';

describe('setupModuleLoder', () => {
  beforeEach(() => {
    delete (<any>window).angular;
  })

  it('exposes angular on the window', () => {
    setupModuleLoder(window);

    expect((<any>window).angular).toBeDefined();
  });

  it('creates angular only once', () => {
    setupModuleLoder(window);
    const ng = (<any>window).angular;
    setupModuleLoder(window);
    expect((<any>window).angular).toBe(ng);
  });
});
