'use strict';
import { Angular, RegisterType } from './loader';

export function createInjector(modulesToLoad: string[], strictInjection?: boolean): Injector {
  return new Injector(modulesToLoad, strictInjection);
}

class Injector {
  private cache: any = {};
  private loadedModules: { [module: string]: boolean } = {};
  private strictInjection = false;

  constructor(modulesToLoad: string[], strictInjection?: boolean) {
    this.strictInjection = !!strictInjection;

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
    if (Array.isArray(func)) {
      return func.slice(0, func.length - 1)
    } else if (func.$inject) {
      return func.$inject;
    } else if (!func.length) {
      return [];
    } else {
      if (this.strictInjection) {
        throw 'Injector.annotateDependencies: Expected depenedencies to be strictly defined.'
      }

      const comments = /(\/\/.*$)|(\/\*.*?\*\/)/mg;
      const argsRegexp = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
      const argRegexp = /^\s*(_?)(\S+?)\1\s*$/;

      const functionWithoutComments = func.toString().replace(comments, '');
      const args = functionWithoutComments.match(argsRegexp);

      return args[1].split(',').map((arg: string) => arg.match(argRegexp)[2]);
    }
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
