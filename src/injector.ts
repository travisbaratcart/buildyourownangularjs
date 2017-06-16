'use strict';
import { Angular, RegisterType } from './loader';

export function createInjector(modulesToLoad: string[]): Injector {
  return new Injector(modulesToLoad);
}

class Injector {
  private cache: any = {};
  private loadedModules: { [module: string]: boolean } = {}

  constructor(modulesToLoad: string[]) {
    modulesToLoad.forEach(moduleName => {
      this.loadModule(moduleName);
    });
  }

  private loadModule(moduleName: string): void {
    if (this.loadedModules[moduleName]) {
      return;
    }

    this.loadedModules[moduleName] = true;

    const module = (<Angular>(<any>window).angular).module(moduleName);

    module.depenedencies.forEach(dependency => this.loadModule(dependency));

    module.$$invokeQueue.forEach(registerItem => {
      this.$provide(registerItem.type)(registerItem.key, registerItem.value);
    });
  }

  public has(key: string): boolean {
    return this.cache.hasOwnProperty(key);
  }

  public invoke(
    func: {(...args: any[]): any, $inject: string[]},
    context?: any,
    locals?: any) {

    const args = func.$inject.map(dependency => {
      if (typeof dependency !== 'string') {
        throw 'Injector.invoke: Invalid dependency key type.';
      }

      const isDependencyInLocals = locals && locals.hasOwnProperty(dependency);

      return isDependencyInLocals
      ? locals[dependency]
      : this.cache[dependency]
    });

    return func.apply(context, args);
  }

  public annotateDependencies(func: any | any[]) {
    return Array.isArray(func)
      ? func.slice(0, func.length - 1)
      : func.$inject;
  }

  private $provide(registerType: RegisterType): (key: string, value: any) => void {
    switch (registerType) {
      case RegisterType.Constant:
        return this.provideConstant;
      default:
        throw 'Injector.$provide: Invalid registration type.';
    }
  }

  private provideConstant = (key: string, value: any) => {
    this.cache[key] = value;
  }
}
