'use strict';
import { Scope } from '../src/scope';
import * as _ from 'lodash';

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

  public reject(rejectVal: any): Promise {
    const deferred = new Deferred(this.$rootScope);

    deferred.reject(rejectVal);

    return deferred.promise;
  }

  public resolve(value: any) {
    return this.when(value);
  }

  public when(
    value: any,
    onFulfilled?: (resolvedValue: any) => any,
    onRejected?: (resolvedValue: any) => any,
    onNotify?: (progress: any) => any) {
    const deferred = new Deferred(this.$rootScope);

    deferred.resolve(value);

    return deferred.promise.then(onFulfilled, onRejected, onNotify);
  }

  public all(promises: Promise[] | { [key: string]: Promise }): Promise {
    const deferred = new Deferred(this.$rootScope);
    const results = Array.isArray(promises)
      ? <any[]>[]
      : <any>{};
    let numLeftToResolve = 0;

    _.forEach(promises, (promise, index) => {
      numLeftToResolve++;

      promise.then((result: any) => {
        results[index] = result;
        numLeftToResolve--;

        if (numLeftToResolve <= 0) {
          deferred.resolve(results);
        }
      });
    });

    if (numLeftToResolve === 0) {
      deferred.resolve(results);
    }

    return deferred.promise;
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

  public notify(progress: any) {
    if (this.promise.$$isFulfilled) {
      return;
    }

    this.promise.$$notifyAll(progress);
  }

  private tryFulfillPromise(state: PromiseState, value: any) {
    if (this.promise.$$isFulfilled) {
      return;
    }

    if (value && typeof value.then === 'function') {
      value.then(
        (resolvedValue: any) => this.resolve(resolvedValue),
        (rejectedValue: any) => this.reject(rejectedValue),
        (progress: any) => this.notify(progress));

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
  public $$onNotify: ((progress: any) => any)[] = [];
  public $$value: any;
  public $$state: PromiseState;
  public $$childPromises: Promise[] = [];

  constructor(
    private $rootScope: Scope) {
    this.$$state = PromiseState.Pending;
  }

  public then(
    onFulfilled: (resolvedValue: any) => any,
    onRejected?: (resolvedValue: any) => any,
    onNotify?: (progress: any) => any): Promise {

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

    if (onNotify) {
      this.$$onNotify.push(onNotify);
    }

    if (this.$$isFulfilled) {
      this.scheduleQueueProcessing();
    }

    this.$$childPromises.push(returnDeferred.promise);
    return returnDeferred.promise;
  }

  public catch(onRejected?: (resolvedValue: any) => any): Promise {
    return this.then(null, onRejected);
  }

  public finally(
    onFinally: () => any,
    onNotify?: (progress: any) => any): Promise {
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
          return this.newImmediatelyInvokedPromise(value, false);
        });
      } else {
        return this.newImmediatelyInvokedPromise(value, false)
      }
    }

    if (onNotify) {
      this.$$onNotify.push(onNotify);
    }

    return this.then(finallyThen, finallyCatch);
  }

  public scheduleQueueProcessing() {
    this.$rootScope.$evalAsync(() => {
      this.processQueue();
    });
  }

  public $$notifyAll(progress: any) {
    let newNotifyResult = progress;

    this.$rootScope.$evalAsync(() => {
      this.$$onNotify.forEach(cb => {
        let result: any;

        try {
          result = cb(progress);
        } catch(error) {
          console.error(error);
        }

        if (result) {
          newNotifyResult = result;
        }
      });

      this.$$childPromises.forEach(childPromise => childPromise.$$notifyAll(newNotifyResult));
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

  private newImmediatelyInvokedPromise(value: any, resolved: boolean): Promise {
    const deferred = new Deferred(this.$rootScope);

    if (resolved) {
      deferred.resolve(value);
    } else {
      deferred.reject(value);
    }

    this.$$childPromises.push(deferred.promise);
    return deferred.promise;
  }
}
