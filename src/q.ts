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
        const nextValue = onFulfilled(value);
        returnDeferred.resolve(nextValue);
      });
    }

    if (onRejected) {
      this.$$onReject.push((value: any) => {
        const nextValue = onRejected(value);
        returnDeferred.resolve(nextValue);
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
    let finallyCb = () => onFinally();

    return this.then(finallyCb, finallyCb);
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
