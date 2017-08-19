'use strict';
import { IProvider, Injector } from './injector';

export class $ControllerProvider implements IProvider {
  public $get = ['$injector', ($injector: Injector) => {
    return new $ControllerService($injector);
  }];
}

export class $ControllerService {
  constructor(private $injector: Injector) {

  }

  public controller(constructorFn: (...args: any[]) => any, locals?: any) {
    return this.$injector.instantiate(constructorFn, locals);
  }
}
