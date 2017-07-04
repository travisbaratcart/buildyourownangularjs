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

  it('does not reject current promise when handler throws', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise
      .then(() => {
        throw 'fail;'
      });

    deferred.promise.catch(rejectSpy);

    $rootScope.$apply();

    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it('waits on promise returned from handler', () => {
    const deferred = $q.defer();
    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .then((value: number) => {
        const deferred2 = $q.defer();

        deferred2.resolve(value + 1);

        return deferred2.promise;
      })
      .then((value: number) => value * 2)
      .then(resolveSpy);

      deferred.resolve(20);

      $rootScope.$apply();

      expect(resolveSpy).toHaveBeenCalledWith(42);
  });

  it('waits on promise given to resolve', () => {
    const deferred = $q.defer();
    const deferred2 = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise.then(resolveSpy);

    deferred2.resolve(42);
    deferred.resolve(deferred2.promise);

    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(42);
  });

  it('rejects when promise returned from handler rejects', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise
      .then(() => {
        const deferred2 = $q.defer();

        deferred2.reject('fail');

        return deferred2.promise;
      })
      .catch(rejectSpy);

    deferred.resolve('ok');

    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('ignores the return value of finally blocks in following then\'s', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .then((result: number) => result + 1)
      .finally(() => 42)
      .then(resolveSpy);

    deferred.resolve(20);

    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith(21);
  });

  it('ignores the return value of finally blocks in following catch\'s', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    deferred.promise
      .then((result: number) => {
        throw 'fail';
      })
      .finally(() => 47)
      .catch(rejectSpy);

    deferred.resolve(20);

    $rootScope.$apply();

    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('resolves to the original value when a promise returned from finally resolves', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');

    let resolveFinally: () => void;

    deferred.promise
      .then((result: number) => result + 1)
      .finally(() => {
        const deferred2 = $q.defer();

        resolveFinally = () => {
          deferred2.resolve('abc');
        };

        return deferred2.promise;
      })
      .then(resolveSpy);

    deferred.resolve(20);

    $rootScope.$apply();
    expect(resolveSpy).not.toHaveBeenCalled();

    resolveFinally();
    $rootScope.$apply();
    expect(resolveSpy).toHaveBeenCalledWith(21);
  });

  it('rejects to original value when a promise returned from finally resolves', () => {
    const deferred = $q.defer();

    const rejectSpy = jasmine.createSpy('rejected');

    let resolveFinally: () => void;

    deferred.promise
      .then(() => {
        throw 'fail';
      })
      .finally(() => {
        const deferred2 = $q.defer();

        resolveFinally = () => {
          deferred2.resolve('abc');
        };

        return deferred2.promise;
      })
      .catch(rejectSpy);

    deferred.resolve(rejectSpy);

    $rootScope.$apply();
    expect(rejectSpy).not.toHaveBeenCalled();

    resolveFinally();
    $rootScope.$apply();
    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('rejects when promise is rejected in finally', () => {
    const deferred = $q.defer();

    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    let rejectFinally: () => void;

    deferred.promise
      .then((result: number) => result + 1)
      .finally(() => {
         const deferred2 = $q.defer();

         rejectFinally = () => {
           deferred2.reject('fail');
         };

         return deferred2.promise;
      })
      .then(resolveSpy, rejectSpy);

    deferred.resolve(20);

    $rootScope.$apply();
    expect(resolveSpy).not.toHaveBeenCalled();

    rejectFinally();
    $rootScope.$apply();
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('can report progress', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');

    deferred.promise
      .then(null, null, progressSpy);

    deferred.notify('working...');

    $rootScope.$apply();

    expect(progressSpy).toHaveBeenCalledWith('working...');
  });

  it('can report progress many times', () => {
    const deferred = $q.defer();
    const progressSpy = jasmine.createSpy('progress');

    deferred.promise.then(null, null, progressSpy);

    deferred.notify('40%');
    $rootScope.$apply();

    deferred.notify('80%');
    deferred.notify('100%');

    $rootScope.$apply();

    expect(progressSpy.calls.count()).toBe(3);
  });

  it('does not notify progress after being resolved', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');

    deferred.promise.then(null, null, progressSpy);

    deferred.resolve('ok');

    deferred.notify('working...');

    $rootScope.$apply();
    expect(progressSpy).not.toHaveBeenCalled();
  });

  it('does not notify progress after being rejected', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');

    deferred.promise.then(null, null, progressSpy);

    deferred.reject('fail');

    deferred.notify('working...');

    $rootScope.$apply();
    expect(progressSpy).not.toHaveBeenCalled();
  });

  it('can notify progress through chain', () => {
    const deferred = $q.defer();
    const progressSpy = jasmine.createSpy('progress');

    deferred.promise
      .then(() => 7)
      .catch(() => 8)
      .then(null, null, progressSpy);

    deferred.notify('working...');
    $rootScope.$apply();

    expect(progressSpy).toHaveBeenCalledWith('working...');
  });

  it('transforms progress through handlers', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');

    deferred.promise
      .then(() => 42)
      .then(null, null, (progress: any) => {
        return `***${progress}***`;
      })
      .catch(() => 43)
      .then(null, null, progressSpy);

    deferred.notify('working...');

    $rootScope.$apply();

    expect(progressSpy).toHaveBeenCalledWith('***working...***');
  });

  it('recovers from progressBack exceptions', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');
    const resolveSpy = jasmine.createSpy('resolved');

    deferred.promise
      .then(null, null, (progress: any) => {
        throw 'fail';
      })

    deferred.promise
      .then(resolveSpy, null, progressSpy);

    deferred.notify('working...');
    deferred.resolve('ok');

    $rootScope.$apply();
    expect(progressSpy).toHaveBeenCalledWith('working...');
    expect(resolveSpy).toHaveBeenCalledWith('ok');
  });

  it('can notify progress through promise return from handler', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');

    deferred.promise
      .then(null, null, progressSpy);

    const deferred2 = $q.defer();

    deferred.resolve(deferred2.promise);

    deferred2.notify('working...');

    $rootScope.$apply();

    expect(progressSpy).toHaveBeenCalledWith('working...');
  });

  it('allows attaching progressBack in finally', () => {
    const deferred = $q.defer();

    const progressSpy = jasmine.createSpy('progress');
    deferred.promise.finally(null, progressSpy);

    deferred.notify('working...');

    $rootScope.$apply();
    expect(progressSpy).toHaveBeenCalledWith('working...');
  });

  it('can make an immediately rejected promise', () => {
    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    const promise = $q.reject('fail');

    promise
      .then(resolveSpy, rejectSpy);

    $rootScope.$apply();

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).toHaveBeenCalledWith('fail');
  });

  it('can make an immediately resolved promise', () => {
    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    const promise = $q.when('ok');

    promise.then(resolveSpy, rejectSpy);

    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith('ok');
    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it('can wrap a foreign promise with when', () => {
    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');

    const promise = $q.when({
      then: function(handler: any) {
        $rootScope.$evalAsync(function() {
          handler('ok');
        });
      }
    });

    promise
      .then(resolveSpy, rejectSpy);

    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith('ok');
    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it('takes callbacks directly when wrapping', () => {
    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine.createSpy('rejected');
    const progressSpy = jasmine.createSpy('progress');

    const wrapped = $q.defer();

    $q.when(
      wrapped.promise,
      resolveSpy,
      rejectSpy,
      progressSpy);

    wrapped.notify('working...');
    wrapped.resolve('ok');
    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith('ok');
    expect(rejectSpy).not.toHaveBeenCalled();
    expect(progressSpy).toHaveBeenCalledWith('working...');
  });

  it('makes an immediately resolved promise with resolve', () => {
    const resolveSpy = jasmine.createSpy('resolved');
    const rejectSpy = jasmine .createSpy('rejected');

    const promise = $q.resolve('ok');
    promise.then(resolveSpy, rejectSpy);

    $rootScope.$apply();

    expect(resolveSpy).toHaveBeenCalledWith('ok');
    expect(rejectSpy).not.toHaveBeenCalled();
  });
});
