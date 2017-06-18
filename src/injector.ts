'use strict';
import { Angular, RegisterType } from './loader';

export function createInjector(modulesToLoad: string[], strictInjection?: boolean): Injector {
  return new Injector(modulesToLoad, strictInjection);
}

interface IProvider {
  $get: () => any;
}

export class Injector {
  private instanceCache: any = {};
  private providerCache: { [providerName: string]: IProvider | InternalInjector } = {};

  private loadedModules: { [module: string]: boolean } = {};

  private instanceInjector: InternalInjector;
  private providerInjector: InternalInjector;

  constructor(modulesToLoad: string[], strictInjection?: boolean) {
    this.providerInjector = this.providerCache.$injector = new InternalInjector(
      this.providerCache,
      null,
      !!strictInjection);

    this.instanceInjector = this.instanceCache.$injector = new InternalInjector(
      this.instanceCache,
      (name: string) => {
        const provider = this.providerInjector.get(this.keyProvider(name));
        return this.instanceInjector.invoke(provider.$get, provider);
      },
      !!strictInjection)

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
    return this.instanceCache.hasOwnProperty(key)
      || this.providerCache.hasOwnProperty(this.keyProvider(key));
  }

  public get(key: string): any {
    if (!this.has(key)) {
      throw `Injector.get: No cached item ${key}`
    }

    return this.instanceInjector.get(key);
  }

  public invoke(
    funcWithDependencies: {(...args: any[]): any, $inject?: string[]} | any[],
    context?: any,
    locals?: any) {

    return this.instanceInjector.invoke(
      funcWithDependencies,
      context,
      locals);
  }

  public annotateDependencies(func: any | any[]): string[] {
    return this.providerInjector.annotateDependencies(func);
  }

  public instantiate(
    constructorWithDependencies: {(...args: any[]): any, $inject?: string[]} | any[],
    locals?: { [key: string]: any }): any {

    return this.instanceInjector.instantiate(
      constructorWithDependencies,
      locals);
  }

  private $provide(registerType: RegisterType): (key: string, value: any) => void {
    switch (registerType) {
      case RegisterType.Constant:
        return this.provideConstant;
      case RegisterType.Provider:
        return this.provideProvider;
      default:
        throw 'Injector.$provide: Invalid registration type.';
    }
  }

  private provideConstant = (key: string, value: any) => {
    this.instanceCache[key] = value;
    this.providerCache[key] = value; // constants replicated everywhere
  }

  private provideProvider = (key: string, value: (() => IProvider) | IProvider) => {
    const provider = typeof value === 'function'
      ? this.providerInjector.instantiate(value)
      : value;

    this.providerCache[this.keyProvider(key)] = provider;
  }

  private keyProvider(key: string): string {
    return `${key}Provider`
  }
}

class InternalInjector {
  // Identifier for dependencies being instantiated
  // Useful for identifying circular dependencies
  private INSTANTIATIONINPROGRESS = {};

  private injectionPath: string[] = [];

  constructor(
    private cache: any,
    private fallBack: (key: string) => void,
    private strictInjection: boolean) {
  }

  public get(name: string): any {
    if (this.cache.hasOwnProperty(name)) {
      if (this.cache[name] === this.INSTANTIATIONINPROGRESS) {
        throw new Error(
          `InternalInjector.getValue: Circular dependency identified. ${name} <- ${this.injectionPath.join(' <- ')}`);
      }

      return this.cache[name];
    } else {
      this.injectionPath.unshift(name);

      this.cache[name] = this.INSTANTIATIONINPROGRESS;

      try {
        if (!this.fallBack) {
          throw `Unknown provider: ${name}`;
        }

        return (this.cache[name] = this.fallBack(name));
      } finally {
        this.injectionPath.shift();

        if (this.cache[name] === this.INSTANTIATIONINPROGRESS) {
          delete this.cache[name];
        }
      }
    }
  }

  public instantiate(
    constructorWithDependencies: {(...args: any[]): any, $inject?: string[]} | any[],
    locals?: { [key: string]: any }): any {

    const constructor = Array.isArray(constructorWithDependencies)
    ? constructorWithDependencies[constructorWithDependencies.length - 1]
    : constructorWithDependencies;

    const instance = Object.create(constructor.prototype);

    this.invoke(constructorWithDependencies, instance, locals);

    return instance;
  }

  public invoke(
    funcWithDependencies: {(...args: any[]): any, $inject?: string[]} | any[],
    context?: any,
    locals?: any) {

    const dependencyNames = this.annotateDependencies(funcWithDependencies);

    const dependencies = dependencyNames.map(dependencyName => {
      if (typeof dependencyName !== 'string') {
        throw 'Injector.invoke: Invalid dependency key type.';
      }

      const isDependencyInLocals = locals && locals.hasOwnProperty(dependencyName);

      return isDependencyInLocals
      ? locals[dependencyName]
      : this.get(dependencyName);
    });

    const func = Array.isArray(funcWithDependencies)
      ? funcWithDependencies[funcWithDependencies.length - 1]
      : funcWithDependencies;

    return func.apply(context, dependencies);
  }

  public annotateDependencies(func: any | any[]): string[] {
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
}
