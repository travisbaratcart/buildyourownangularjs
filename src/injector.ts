'use strict';
import { Angular, RegisterType } from './loader';

export function createInjector(modulesToLoad: string[], strictInjection?: boolean): Injector {
  return new Injector(modulesToLoad, strictInjection);
}

interface IProvider {
  $get: () => any;
}

class Injector {
  private instanceCache: any = {};
  private providerCache: { [providerName: string]: IProvider } = {};
  private loadedModules: { [module: string]: boolean } = {};
  private strictInjection = false;

  private injectionPath: string[] = [];

  // Identifier for dependencies being instantiated
  // Useful for identifying circular dependencies
  private INSTANTIATIONINPROGRESS = {};

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
    return this.instanceCache.hasOwnProperty(key)
      || this.providerCache.hasOwnProperty(this.normalizeProviderName(key));
  }

  public get(key: string): any {
    if (!this.has(key)) {
      throw `Injector.get: No cached item ${key}`
    }

    return this.getValue(key);
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
      : this.getValue(dependencyName);
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
  }

  private provideProvider = (key: string, provider: IProvider) => {
    this.providerCache[this.normalizeProviderName(key)] = provider;
  }

  private normalizeProviderName(providerName: string): string {
    return `${providerName}Provider`;
  }

  private getValue(name: string): any {
    if (this.instanceCache.hasOwnProperty(name)) {
      if (this.instanceCache[name] === this.INSTANTIATIONINPROGRESS) {
        throw new Error(
          `Injector.getValue: Circular dependency identified. ${name} <- ${this.injectionPath.join(' <- ')}`);

      }

      return this.instanceCache[name];
    } else if (this.providerCache.hasOwnProperty(this.normalizeProviderName(name))) {
      this.injectionPath.unshift(name);

      this.instanceCache[name] = this.INSTANTIATIONINPROGRESS;

      try {
        const provider = this.providerCache[this.normalizeProviderName(name)];

        const instance = this.invoke(provider.$get, provider);

        this.instanceCache[name] = instance;

        return instance;
      } finally {
        this.injectionPath.shift();

        if (this.instanceCache[name] === this.INSTANTIATIONINPROGRESS) {
          delete this.instanceCache[name];
        }
      }
    } else {
      throw `Injector.getValue: No registered item for name ${name}`;
    }
  }
}
