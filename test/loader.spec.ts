'use strict';
import { setupModuleLoder } from '../src/loader';

describe('setupModuleLoder', () => {
  it('exposes angular on the window', () => {
    setupModuleLoder(window);

    expect((<any>window).angular).toBeDefined();
  });
});
