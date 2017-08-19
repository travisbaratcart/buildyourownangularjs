'use strict';
import { Angular, setupModuleLoader } from './loader';
import { $FilterProvider } from './filter';
import { $ParseProvider } from './parse';
import { $RootScopeProvider } from './scope';
import { $QProvider, $$QProvider } from './q';
import { $HttpBackendProvider } from './httpBackend';
import {
  $HttpProvider,
  $HttpParamSerializerProvider,
  $HttpParamSerializerJQLikeProvider
} from './http';
import { $CompileProvider } from './compile';
import { $ControllerProvider} from './controller';

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
  ngModule.provider('$httpParamSerializerJQLike', $HttpParamSerializerJQLikeProvider);
  ngModule.provider('$compile', $CompileProvider);
  ngModule.provider('$controller', $ControllerProvider);
}
