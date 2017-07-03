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
    this.promise.$$state.value = value;
    this.scheduleQueueProcessing();
  }

  private scheduleQueueProcessing() {
    this.$rootScope.$evalAsync(() => {
      this.processQueue();
    });
  }

  private processQueue() {
    this.promise.$$state.pending(this.promise.$$state.value);
  }
}

interface IPromiseState {
  pending?: (resolvedValue: any) => any;
  value?: any;
}

class Promise {
  public $$state: IPromiseState = {};

  public then(onFulfilled: (resolvedValue: any) => any) {
    this.$$state.pending = onFulfilled;
  }
}
