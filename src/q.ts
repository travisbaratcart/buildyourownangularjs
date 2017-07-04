'use strict';
import { Scope } from '../src/scope';

export class $QProvider {
  public $get = ['$rootScope', function($rootScope: Scope) {
    return new $QService($rootScope);
  }];
}

export class $QService {
  constructor(
    private $rootScope: Scope) {

  }

  public defer() {
    return new Deferred(this.$rootScope);
  }
}

class Deferred {
  promise: Promise;

  constructor($rootScope: Scope) {
    this.promise = new Promise($rootScope);
  }

  public resolve(value: any) {
    this.tryFulfillPromise(PromiseState.Resolved, value);
  }

  public reject(value: any) {
    this.tryFulfillPromise(PromiseState.Rejected, value);
  }

  private tryFulfillPromise(state: PromiseState, value: any) {
    if (this.promise.$$isFulfilled) {
      return;
    }

    if (value && typeof value.then === 'function') {
      value.then(
        (resolvedValue: any) => this.resolve(resolvedValue),
        (rejectedValue: any) => this.reject(rejectedValue));

      return;
    }

    this.promise.$$state = state;
    this.promise.$$value = value;
    this.promise.scheduleQueueProcessing();
  }
}

enum PromiseState {
  NotSpecified,
  Pending,
  Resolved,
  Rejected
}

class Promise {
  public $$onResolve: ((resolvedValue: any) => any)[] = [];
  public $$onReject: ((rejectedValue: any) => any)[] = [];
  public $$value: any;
  public $$state: PromiseState;

  constructor(
    private $rootScope: Scope) {
    this.$$state = PromiseState.Pending;
  }

  public then(
    onFulfilled: (resolvedValue: any) => any,
    onRejected?: (resolvedValue: any) => any): Promise {

    const returnDeferred = new Deferred(this.$rootScope);

    if (onFulfilled) {
      this.$$onResolve.push((value: any) => {
        try {
          const nextValue = onFulfilled(value);
          returnDeferred.resolve(nextValue);
        } catch(error) {
          returnDeferred.reject(error);
        }

      });
    } else {
      this.$$onResolve.push((value: any) => {
        returnDeferred.resolve(value);
      });
    }

    if (onRejected) {
      this.$$onReject.push((value: any) => {
        try {
          const nextValue = onRejected(value);
          returnDeferred.resolve(nextValue);
        } catch(error) {
          returnDeferred.reject(error);
        }
      });
    } else {
      this.$$onReject.push((value: any) => {
        returnDeferred.reject(value);
      });
    }

    if (this.$$isFulfilled) {
      this.scheduleQueueProcessing();
    }

    return returnDeferred.promise;
  }

  public catch(onRejected?: (resolvedValue: any) => any): Promise {
    return this.then(null, onRejected);
  }

  public finally(onFinally: () => any): Promise {
    const finallyThen = (value: any) => {
      const result = onFinally();

      if (result && typeof result.then === 'function') {
        return result.then(() => value);
      } else {
        return value;
      }
    }

    const finallyCatch = (value: any) => {
      const result = onFinally();

      if (result && typeof result.then === 'function') {
        return result.then(() => {
          const deferred = new Deferred(this.$rootScope);

          deferred.reject(value);

          return deferred.promise;
        });
      } else {
        const deferred = new Deferred(this.$rootScope);
        deferred.reject(value);
        return deferred.promise;
      }
    }

    return this.then(finallyThen, finallyCatch);
  }

  public scheduleQueueProcessing() {
    this.$rootScope.$evalAsync(() => {
      this.processQueue();
    });
  }

  public get $$isFulfilled(): boolean {
    return this.$$state === PromiseState.Resolved
      || this.$$state === PromiseState.Rejected;
  }

  private processQueue() {
    const cbs = this.$$state === PromiseState.Resolved
      ? this.$$onResolve
      : this.$$onReject;

    while (cbs.length > 0) {
      const cb = cbs.pop();
      cb(this.$$value);
    }
  }
}
