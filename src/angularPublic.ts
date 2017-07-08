'use strict';
import { Angular, setupModuleLoader } from './loader';
import { $FilterProvider } from './filter';
import { $ParseProvider } from './parse';
import { $RootScopeProvider } from './scope';
import { $QProvider, $$QProvider } from './q';
import { $HttpBackendProvider } from './httpBackend';
import { $HttpProvider, $HttpParamSerializerProvider } from './http';

export function publishExternalAPI(): void {
  setupModuleLoader(window);

  const ngModule = (<Angular>(<any>window).angular).module('ng', []);

  ngModule.provider('$filter', $FilterProvider);
  ngModule.provider('$parse', $ParseProvider);
  ngModule.provider('$rootScope', $RootScopeProvider);
  ngModule.provider('$q', $QProvider);
  ngModule.provider('$$q', $$QProvider);
  ngModule.provider('$httpBackend', $HttpBackendProvider);
  ngModule.provider('$http', $HttpProvider);
  ngModule.provider('$httpParamSerializer', $HttpParamSerializerProvider);
}
