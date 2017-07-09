'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { Angular } from '../src/loader';
import { createInjector } from '../src/injector';

describe('$compile', () => {
  let angular: Angular;

  beforeEach(() => {
    delete (<any>window).angular;
    publishExternalAPI();

    angular = (<any>window).angular;
  });

  it('allows creating directives', () => {
    const myModule = angular.module('myModule', []);
    myModule.directive('testing', function() { return {}; });
    const injector = createInjector(['ng', 'myModule']);
    expect(injector.has('testingDirective')).toBe(true);
  });
});
