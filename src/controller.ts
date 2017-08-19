'use strict';
import { IProvider, Injector, Invokable } from './injector';

interface IRegisteredControllers {
  [controllerName: string]: Invokable;
}

export class $ControllerProvider implements IProvider {
  public $get = ['$injector', ($injector: Injector) => {
    return new $ControllerService($injector, this.registeredControllers);
  }];

  private registeredControllers: IRegisteredControllers = {};

  public register(controllerName: string, constructorFn: Invokable) {
    this.registeredControllers[controllerName] = constructorFn;
  }
}

export class $ControllerService {
  constructor(
    private $injector: Injector,
    private registeredControllers: IRegisteredControllers) {

  }

  public controller(controllerNameOrConstructor: Invokable | string, locals?: any) {
    var controllerConstructor = typeof controllerNameOrConstructor === 'string'
      ? this.registeredControllers[controllerNameOrConstructor]
      : controllerNameOrConstructor;

    return this.$injector.instantiate(controllerConstructor, locals);
  }
}
