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
}

class Promise {

}
