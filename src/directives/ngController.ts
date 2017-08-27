'use strict';
import { IDirectiveDefinitionObject } from '../compile';

export function ngControllerDirective(): IDirectiveDefinitionObject {
  return {
    restrict: 'A',
    scope: true,
    controller: '@'
  };
}
