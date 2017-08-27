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
    let controllerInvokable: Invokable;
    let controllerIdentifier = identifier;

    if (typeof controllerNameOrInvokable === 'string') {
      const controllerMatches = controllerNameOrInvokable.match(/^(\S+)(\s+as\s+(\w+))?/);

      const controllerName = controllerMatches[1];

      if (controllerMatches[3]) {
        controllerIdentifier = controllerMatches[3];
      }

      const registeredInvokable = this.registeredControllers[controllerName];

      const scopeInvokable = locals && locals.$scope && locals.$scope[controllerName];

      const globalInvokable = (<any>window)[controllerName];

      controllerInvokable = registeredInvokable || scopeInvokable || (this.globalsAllowed && globalInvokable);
    } else {
      controllerInvokable = <Invokable>controllerNameOrInvokable;
    }

    if (delayConstruction) {
      const controllerConstructor = <Function>(Array.isArray(controllerInvokable)
        ? controllerInvokable[controllerInvokable.length - 1]
        : controllerInvokable);

      const instance = Object.create(controllerConstructor.prototype);

      if (controllerIdentifier) {
        this.addToScope(locals.$scope, instance, controllerIdentifier);
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
        this.addToScope(locals.$scope, instance, controllerIdentifier);
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
