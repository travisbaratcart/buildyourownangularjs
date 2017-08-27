'use strict';
import { IProvider, Injector, Invokable } from './injector';
import { Scope } from './scope';
import * as _ from 'lodash';

interface IRegisteredControllers {
  [controllerName: string]: Invokable;
}

interface InvokableObject {
  [invokableName: string]: Invokable
}

export type ControllerFunction = (
  controllerNameOrConstructor: Invokable | string,
  locals?: any,
  delayConstruction?: boolean,
  identifier?: string) => any;

export class $ControllerProvider implements IProvider {
  private globalsAllowed = false;
  private $injector: Injector;

  public $get = ['$injector', ($injector: Injector) => {
    this.$injector = $injector;
    return this.controllerFunction;
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

  private controllerFunction: ControllerFunction =  (controllerNameOrInvokable, locals, delayConstruction, identifier) => {
    const registeredInvokable = this.registeredControllers[<string>controllerNameOrInvokable];
    const globalInvokable = (<any>window)[<string>controllerNameOrInvokable];

    const retrievedInvokable = registeredInvokable || (this.globalsAllowed && globalInvokable);

    const controllerInvokable = typeof controllerNameOrInvokable === 'string'
    ? retrievedInvokable
    : controllerNameOrInvokable;



    if (delayConstruction) {
      const controllerConstructor = Array.isArray(controllerInvokable)
        ? controllerInvokable[controllerInvokable.length - 1]
        : controllerInvokable;

      const instance = Object.create(controllerConstructor);

      if (identifier) {
        this.addToScope(locals.$scope, instance, identifier);
      }

      return _.extend(() => {
        this.$injector.invoke(controllerInvokable, instance, locals);
        return instance;
      }, {
        instance: instance
      });
    } else {
      const instance = this.$injector.instantiate(controllerInvokable, locals);

      if (identifier) {
        this.addToScope(locals.$scope, instance, identifier);
      }

      return instance;
    }
  };

  private addToScope(scope: Scope, instance: any, identifier: string) {
    if (!scope || !identifier) {
      return;
    }

    (<any>scope)[identifier] = instance;
  }
}
