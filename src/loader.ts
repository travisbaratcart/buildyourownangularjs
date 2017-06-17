'use strict';

export enum RegisterType {
  NotSpecified,
  Constant,
  Provider
}

interface IRegisterItem {
  type: RegisterType;
  key: string;
  value: any;
}

export function setupModuleLoder(window: any): void {
  const angular = ensure(window, 'angular', () => new Angular());
}

function ensure (obj: any, name: string, factory: () => any): any {
  return obj[name] || (obj[name] = factory());
}

class Module {
  public $$invokeQueue: IRegisterItem[] = [];

  constructor(
    public name: string,
    public depenedencies: string[]) {

  }

  public constant(key: string, value: any): void {
    this.addInvokeItem(RegisterType.Constant, key, value);
  }

  public provider(key: string, value: any): void {
    this.addInvokeItem(RegisterType.Provider, key, value);
  }

  private addInvokeItem(registerType: RegisterType, key: string, value: any): void {
    const newRegisterItem: IRegisterItem = {
      type: registerType,
      key,
      value
    };

    this.$$invokeQueue.push(newRegisterItem);
  }
}

export class Angular {
  private modules: { [moduleName: string]: Module } = {};

  public module(moduleName: string, depenedencies?: any[]): Module {
    if (depenedencies) {
      return this.createModule(moduleName, depenedencies);
    } else {
      return this.getModule(moduleName);
    }
  }

  private createModule(moduleName: string, depenedencies: any[]): Module {
    const newModule = new Module(moduleName, depenedencies);

    this.modules[moduleName] = newModule;

    return newModule;
  }

  private getModule(moduleName: string): Module {
    const gotModule = this.modules[moduleName];

    if (!gotModule) {
      throw `Module ${moduleName} is not available`;
    }

    return gotModule;
  }
}
