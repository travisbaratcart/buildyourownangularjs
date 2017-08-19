'use strict';
import { IProvider, Injector, Invokable } from './injector';
import * as _ from 'lodash';

interface IRegisteredControllers {
  [controllerName: string]: Invokable;
}

interface InvokableObject {
  [invokableName: string]: Invokable
}

export class $ControllerProvider implements IProvider {
  public $get = ['$injector', ($injector: Injector) => {
    return new $ControllerService($injector, this.registeredControllers);
  }];

  private registeredControllers: IRegisteredControllers = {};

  public register(controllerNameOrObject: string | InvokableObject, constructorFn?: Invokable) {
    if (typeof controllerNameOrObject === 'object') {
      _.forEach(controllerNameOrObject, (constructorFn, controllerName) => {
        this.register(controllerName, constructorFn);
      });
    } else {
      this.registeredControllers[controllerNameOrObject] = constructorFn;
    }
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
