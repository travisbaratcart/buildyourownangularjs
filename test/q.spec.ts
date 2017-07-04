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

  it('resolves a listener added after resolution', () => {
    const deferred = $q.defer();

    deferred.resolve(42);

    $rootScope.$apply();

    const promiseSpy = jasmine.createSpy('promise');

    deferred.promise.then(promiseSpy);

    $rootScope.$apply();

    expect(promiseSpy).toHaveBeenCalledWith(42);
  });

  it('may have multiple callbacks', () => {
    const deferred = $q.defer();

    const firstSpy = jasmine.createSpy('first');
    const secondSpy = jasmine.createSpy('second');

    deferred.promise.then(firstSpy);
    deferred.promise.then(secondSpy);

    deferred.resolve(42);
    $rootScope.$apply();

    expect(firstSpy).toHaveBeenCalledWith(42);
    expect(secondSpy).toHaveBeenCalledWith(42);
  });

  it('invokes callbacks once', () => {
    const deferred = $q.defer();

    const firstSpy = jasmine.createSpy('first');
    const secondSpy = jasmine.createSpy('second');

    deferred.promise.then(firstSpy);
    deferred.resolve(42);

    $rootScope.$apply();
    expect(firstSpy.calls.count()).toBe(1);
    expect(secondSpy.calls.count()).toBe(0);

    deferred.promise.then(secondSpy);
    expect(firstSpy.calls.count()).toBe(1);
    expect(secondSpy.calls.count()).toBe(0);

    $rootScope.$apply();
    expect(firstSpy.calls.count()).toBe(1);
    expect(secondSpy.calls.count()).toBe(1);
  });

  it('can reject a deferred', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');
    deferred.promise.then(resolveSpy, rejectSpy);

    deferred.reject('fail');

    $rootScope.$apply();

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('can reject just once', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise.then(null, rejectSpy);

    deferred.reject('fail');
    $rootScope.$apply();
    expect(rejectSpy.calls.count()).toBe(1);

    deferred.reject('fail again');
    $rootScope.$apply();
    expect(rejectSpy.calls.count()).toBe(1);
  });

  it('cannot fulfill a promise once rejected', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');
    deferred.promise.then(resolveSpy, rejectSpy);

    deferred.reject('fail');
    $rootScope.$apply();

    deferred.resolve('success');
    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it('does not require a failure handler each time', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise.then(resolveSpy);
    deferred.promise.then(null, rejectSpy);

    deferred.reject('fail');
    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('does not require a success handler each time', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise.then(resolveSpy);
    deferred.promise.then(null, rejectSpy);

    deferred.resolve('ok');
    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith('ok');
  });

  it('can register rejection handler with catch', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');
    deferred.promise.catch(rejectSpy);
    deferred.reject('fail');

    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalled();
  });

  it('invokes a finally handler when resolved', () => {
    const deferred = $q.defer();

    const finallySpy = jasmine.createSpy('finally');

    deferred.promise.finally(finallySpy);

    deferred.resolve(42);
    $rootScope.$apply();
    expect(finallySpy).toHaveBeenCalledWith();
  });

  it('invokes a finally handler when rejected', () => {
    const deferred = $q.defer();

    const finallySpy = jasmine.createSpy('finally');

    deferred.promise.finally(finallySpy);

    deferred.reject('fail');
    $rootScope.$apply();
    expect(finallySpy).toHaveBeenCalledWith();
  });

  it('allows chaining handlers', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .then((result: number) => result + 1)
      .then((result: number) => result * 2)
      .then(resolveSpy)

    deferred.resolve(20);

    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(42);
  });

  it('does not modify original resolution in chains', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .then((result: number) => result + 1)
      .then((result: number) => result * 2);

    deferred.promise.then(resolveSpy);

    deferred.resolve(20);

    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(20);
  });

  it('catches rejection on chained handler', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');
    deferred.promise
      .then(() => 7)
      .catch(rejectSpy);

    deferred.reject('fail');

    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('fulfills on chained handler', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .catch(() => 7)
      .then(resolveSpy);

    deferred.resolve(42);
    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(42);
  });

  it('treats catch return value as a resolution', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .catch(() => 42)
      .then(resolveSpy);

    deferred.reject('fail');

    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(42);
  });

  it('rejects the chained promise when handler throws', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise
      .then(() => {
        throw 'fail';
      })
      .catch(rejectSpy);

    deferred.resolve(42);

    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });
});
