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
  private globalsAllowed = false;

  public $get = ['$injector', ($injector: Injector) => {
    return (controllerNameOrConstructor: Invokable | string, locals?: any) => {
      const registeredConstructor = this.registeredControllers[<string>controllerNameOrConstructor];
      const globalConstructor = (<any>window)[<string>controllerNameOrConstructor];

      const retrievedConstructor = registeredConstructor || (this.globalsAllowed && globalConstructor);

      const controllerConstructor = typeof controllerNameOrConstructor === 'string'
        ? retrievedConstructor
        : controllerNameOrConstructor;

      return $injector.instantiate(controllerConstructor, locals);
    };
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

  public allowGlobals() {
    this.globalsAllowed = true;
  }
}
