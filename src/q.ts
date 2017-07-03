'use strict';

export class $QProvider {
  public $get() {
    return new $QService();
  }
}

export class $QService {
  public defer() {
    return new Deferred();
  }
}

class Deferred {
  promise: Promise;

  constructor() {
    this.promise = new Promise();
  }

  public resolve(value: any) {
    this.promise.$$state.pending(value);
  }
}

interface IPromiseState {
  pending?: (resolvedValue: any) => any
}

class Promise {
  private $$state: IPromiseState = {};

  public then(onFulfilled: (resolvedValue: any) => any) {
    this.$$state.pending = onFulfilled;
  }
}
