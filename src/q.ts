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

  constructor(
    private $rootScope: Scope) {
    this.promise = new Promise();
  }

  public resolve(value: any) {
    if (this.promise.$$fulfilled) {
      return;
    }

    this.promise.$$fulfilled = true;
    this.promise.$$value = value;
    this.scheduleQueueProcessing();
  }

  private scheduleQueueProcessing() {
    this.$rootScope.$evalAsync(() => {
      this.processQueue();
    });
  }

  private processQueue() {
    this.promise.$$pending(this.promise.$$value);
  }
}

interface IPromiseState {
  pending?: (resolvedValue: any) => any;
  value?: any;
}

class Promise {
  public $$pending: (resolvedValue: any) => any;
  public $$value: any;
  public $$fulfilled = false;

  public then(onFulfilled: (resolvedValue: any) => any) {
    this.$$pending = onFulfilled;
  }
}
