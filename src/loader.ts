'use strict';

export enum RegisterType {
  NotSpecified,
  Constant,
  Provider
}

export function setupModuleLoder(window: any): void {
  const angular = ensure(window, 'angular', () => new Angular());
}

function ensure (obj: any, name: string, factory: () => any): any {
  return obj[name] || (obj[name] = factory());
}

interface IRegisterItem {
  key: string,
  value: any
}

class Module {
  public $$providerRegistrations: IRegisterItem[] = [];
  public $$constantRegistrations: IRegisterItem[] = [];
  public $$configRegistrations: ((...args: any[]) => any)[] = [];

  constructor(
    public name: string,
    public depenedencies: string[],
    configFunction?: ((...args: any[]) => any)) {

    if (configFunction) {
      this.config(configFunction);
    }
  }

  public constant(key: string, value: any): void {
    const newConstant: IRegisterItem = { key, value };
    this.$$constantRegistrations.push(newConstant);
  }

  public provider(key: string, value: any): void {
    const newProvider: IRegisterItem = { key, value };
    this.$$providerRegistrations.push(newProvider);
  }

  public config(configFunction: (...args: any[]) => any) {
    this.$$configRegistrations.push(configFunction);
  }
}

export class Angular {
  private modules: { [moduleName: string]: Module } = {};

  public module(
    moduleName: string,
    depenedencies?: any[],
    configFunction?: (...args: any[]) => any): Module {
    if (depenedencies) {
      return this.createModule(moduleName, depenedencies, configFunction);
    } else {
      return this.getModule(moduleName);
    }
  }

  private createModule(
    moduleName: string,
    depenedencies: any[],
    configFunction?: (...args: any[]) => any): Module {
    const newModule = new Module(moduleName, depenedencies, configFunction);

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
