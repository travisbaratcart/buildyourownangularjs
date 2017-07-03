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
    onRejected?: (resolvedValue: any) => any) {

    if (onFulfilled) {
      this.$$onResolve.push(onFulfilled);
    }

    if (onRejected) {
      this.$$onReject.push(onRejected);
    }

    if (this.$$isFulfilled) {
      this.scheduleQueueProcessing();
    }
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
