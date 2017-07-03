'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector } from '../src/injector';
import { $QService } from '../src/q';
import { Scope } from '../src/scope';

describe('q', () => {
  let $q: $QService;
  let $rootScope: Scope;

  beforeEach(() => {
    publishExternalAPI();
    const injector = createInjector(['ng']);

    $q = injector.get('$q');
    $rootScope = injector.get('$rootScope');
  });

  it('can create a deferred', () => {
    const deferred = $q.defer();

    expect(deferred).toBeDefined();
  });

  it('has a promise for each deferred', () => {
    const deferred = $q.defer();

    expect(deferred.promise).toBeDefined();
  });

  it('can resolve a promise', (done) => {
    const deferred = $q.defer();
    const promise = deferred.promise;

    const promiseSpy = jasmine.createSpy('promise');
    promise.then(promiseSpy);

    deferred.resolve('a-ok');

    setTimeout(function() {
      expect(promiseSpy).toHaveBeenCalledWith('a-ok');
      done()
    }, 1);
  });

  it('works when resolved before promise listener', (done) => {
    const deferred = $q.defer();
    deferred.resolve(42);

    const promiseSpy = jasmine.createSpy('promise');

    deferred.promise.then(promiseSpy);

    setTimeout(() => {
      expect(promiseSpy).toHaveBeenCalledWith(42);
      done();
    }, 1);
  });

  it('resolves promise at the next digest', () => {
    const deferred = $q.defer();

    const promiseSpy = jasmine.createSpy('promise');

    deferred.promise.then(promiseSpy);

    deferred.resolve(42);

    $rootScope.$apply();

    expect(promiseSpy).toHaveBeenCalledWith(42);
  });

  it('may only ever be resolved once', () => {
    const deferred = $q.defer();

    const promiseSpy = jasmine.createSpy('promise');
    deferred.promise.then(promiseSpy);

    deferred.resolve(42);

    $rootScope.$apply();
    expect(promiseSpy).toHaveBeenCalledWith(42);

    deferred.resolve(43);
    $rootScope.$apply();

    expect(promiseSpy.calls.count()).toBe(1);
  });
});
