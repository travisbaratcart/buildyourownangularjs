'use strict';
import { Angular, setupModuleLoader } from './loader';
import { $FilterProvider } from './filter';
import { $ParseProvider } from './parse';
import { $RootScopeProvider } from './scope';
import { $QProvider } from './q';

export function publishExternalAPI(): void {
  setupModuleLoader(window);

  const ngModule = (<Angular>(<any>window).angular).module('ng', []);

  ngModule.provider('$filter', $FilterProvider);
  ngModule.provider('$parse', $ParseProvider);
  ngModule.provider('$rootScope', $RootScopeProvider);
  ngModule.provider('$q', $QProvider);
}
