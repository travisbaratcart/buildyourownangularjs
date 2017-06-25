'use strict';

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
  public $$constantRegistrations: IRegisterItem[] = [];
  public $$factoryRegistrations: IRegisterItem[] = [];
  public $$providerRegistrations: IRegisterItem[] = [];
  public $$valueRegistrations: IRegisterItem[] = [];
  public $$serviceRegistrations: IRegisterItem[] = [];
  public $$decoratorRegistrations: IRegisterItem[] = [];
  public $$configRegistrations: ((...args: any[]) => any)[] = [];
  public $$runRegistrations: ((...args: any[]) => any)[] = [];

  constructor(
    public name: string,
    public depenedencies: string[],
    configFunction?: ((...args: any[]) => any)) {

    if (configFunction) {
      this.config(configFunction);
    }
  }

  public constant(key: string, value: any): void {
    this.registerItem(key, value, this.$$constantRegistrations);
  }

  public provider(key: string, value: any): void {
    this.registerItem(key, value, this.$$providerRegistrations);
  }

  public factory(key: string, value: (...args: any[]) => any): void {
    this.registerItem(key, value, this.$$factoryRegistrations);
  }

  public value(key: string, value: any): void {
    this.registerItem(key, value, this.$$valueRegistrations);
  }

  public service(key: string, value: (...args: any[]) => any): void {
    this.registerItem(key, value, this.$$serviceRegistrations);
  }

  public decorator(serviceName: string, decoratorFunc: (...args: any[]) => any) {
    this.registerItem(serviceName, decoratorFunc, this.$$decoratorRegistrations);
  }

  public run(onRun: (...args: any[]) => any): void {
    this.$$runRegistrations.push(onRun);
  }

  public config(configFunction: (...args: any[]) => any) {
    this.$$configRegistrations.push(configFunction);
  }

  private registerItem(key: string, value: any, registrations: any[]): void {
    const newRegistration: IRegisterItem = { key, value };
    registrations.push(newRegistration);
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
