'use strict';
import { setupModuleLoader } from './loader';

export function publishExternalAPI(): void {
  setupModuleLoader(window);

  const ngModule = (<any>window).angular.module('ng', []);
}
