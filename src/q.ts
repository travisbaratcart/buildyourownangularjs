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
    if (this.promise.$$fulfilled) {
      return;
    }

    this.promise.$$fulfilled = true;
    this.promise.$$value = value;
    this.promise.scheduleQueueProcessing();
  }
}

interface IPromiseState {
  pending?: (resolvedValue: any) => any;
  value?: any;
}

class Promise {
  public $$onResolve: ((resolvedValue: any) => any)[] = [];
  public $$value: any;
  public $$fulfilled = false;

  constructor(
    private $rootScope: Scope) {

  }

  public then(onFulfilled: (resolvedValue: any) => any) {
    this.$$onResolve.push(onFulfilled);

    if (this.$$fulfilled) {
      this.scheduleQueueProcessing();
    }
  }

  public scheduleQueueProcessing() {
    this.$rootScope.$evalAsync(() => {
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.$$onResolve.length > 0) {
      const cb = this.$$onResolve.pop();
      cb(this.$$value);
    }
  }
}
