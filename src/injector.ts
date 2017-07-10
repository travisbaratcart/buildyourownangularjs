'use strict';
import { Angular } from './loader';
import { HashMap } from './hash';
import { IFilter, $FilterProvider } from './filter';
import {
  $CompileProvider,
  IDirectiveDefinitionObject,
  IDirectiveFactoryObject,
  DirectiveFactory
} from './compile';

export function createInjector(modulesToLoad: (string | IInjectableFunction)[], strictInjection?: boolean): Injector {
  return new Injector(modulesToLoad, strictInjection);
}

export interface IProvider {
  $get: Invokable;
}

export type Invokable = IInjectableFunction | (string | ((...args: any[]) => any))[];

interface IInjectableFunction {
  (...args: any[]): any,
  $inject?: string[]
}

export interface IProvide { [type: string]: (key: string, value: any) => void }

interface IProviderCache {
  $injector?: InternalInjector;
  $provide?: IProvide;
  [providerName: string]: IProvider | InternalInjector | IProvide;
}

export class Injector {
  private instanceCache: any = {};
  private providerCache: IProviderCache = {};

  private loadedModules = new HashMap();

  private instanceInjector: InternalInjector;
  private providerInjector: InternalInjector;

  private onRunQueue: ((...args: any[]) => any)[] = [];

  constructor(modulesToLoad: (string | IInjectableFunction)[], strictInjection?: boolean) {
    this.providerInjector = this.providerCache.$injector = new InternalInjector(
      this.providerCache,
      null,
      !!strictInjection);

    this.add$provideToProviderCache();

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

    this.onRunQueue.forEach(onRun => {
      this.instanceInjector.invoke(onRun);
    });
  }

  private loadModule(module: string | IInjectableFunction): void {
    if (this.loadedModules.get(module)) {
      return;
    }

    this.loadedModules.put(module, true);

    if (typeof module === 'string') {
      this.loadRegisteredModule(module);
    } else {
      const onRun = this.providerInjector.invoke(module);

      if (typeof onRun === 'function') {
        this.onRunQueue.push(onRun);
      }
    }
  }

  private loadRegisteredModule(moduleName: string): void {
    const module = (<Angular>(<any>window).angular).module(moduleName);

    module.depenedencies.forEach(dependency => this.loadModule(dependency));

    module.$$constantRegistrations.forEach(registerItem => {
      this.provideConstant(registerItem.key, registerItem.value);
    });

    module.$$providerRegistrations.forEach(registerItem => {
      this.provideProvider(registerItem.key, registerItem.value);
    });

    module.$$valueRegistrations.forEach(registerItem => {
      this.provideValue(registerItem.key, registerItem.value);
    })

    module.$$factoryRegistrations.forEach(registerItem => {
      this.provideFactory(registerItem.key, registerItem.value);
    });

    module.$$serviceRegistrations.forEach(registerItem => {
      this.provideService(registerItem.key, registerItem.value);
    });

    module.$$decoratorRegistrations.forEach(registerItem => {
      this.provideDecorator(registerItem.key, registerItem.value);
    });

    module.$$filterRegistrations.forEach(registerItem => {
      this.provideFilter(registerItem.key, registerItem.value);
    });

    module.$$directiveRegistrations.forEach(registerItem => {
      this.provideDirective(registerItem.key, registerItem.value);
    });

    module.$$configRegistrations.forEach(configFunc => {
      this.providerInjector.invoke(configFunc)
    });

    this.onRunQueue = this.onRunQueue.concat(module.$$runRegistrations);
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

  private provideFactory = (
    key: string,
    inputFactoryFunction: () => any,
    requireValue = true) => {

    const factoryFunction = requireValue
      ? this.enforceReturnValue(inputFactoryFunction)
      : inputFactoryFunction;

    const factoryProvider: IProvider = {
      $get: factoryFunction
    };

    this.provideProvider(key, factoryProvider);
  }

  private provideValue = (key: string, value: any) => {
    this.provideFactory(key, () => value, false);
  }

  private provideService = (key: string, Constructor: (...args: any[]) => any) => {
    this.provideFactory(key, () => {
      return this.instanceInjector.instantiate(Constructor);
    });
  }

  private provideDecorator = (serviceName: string, decoratorFunc: (...args: any[]) => any) => {
    const provider = this.providerInjector.get(this.keyProvider(serviceName));

    const original$get = provider.$get;

    provider.$get = () => {
      const instance = this.instanceInjector.invoke(original$get, provider);

      this.instanceInjector.invoke(decoratorFunc, null, { $delegate: instance });

      return instance;
    };
  }

  private provideFilter = (filterName: string, filterFactory: () => IFilter) => {
    (<$FilterProvider>this.providerInjector.get('$filterProvider'))
      .register(filterName, filterFactory);
  }

  private provideDirective = (directiveNameOrObject: string | IDirectiveFactoryObject, directiveFactory?: DirectiveFactory) => {
    (<$CompileProvider>this.providerInjector.get('$compileProvider'))
      .directive(directiveNameOrObject, directiveFactory);
  }

  private keyProvider(key: string): string {
    return `${key}Provider`
  }

  private keyFilter(key: string): string {
    return `${key}Filter`;
  }

  private add$provideToProviderCache(): void {
    const $provide: IProvide = {
      constant: this.provideConstant,
      provider: this.provideProvider,
      factory: this.provideFactory,
      service: this.provideService,
      decorator: this.provideDecorator,
      filter: this.provideFilter,
      directive: this.provideDirective
    };

    this.providerCache.$provide = $provide;
  }

  private enforceReturnValue(factoryFunction: (...args: any[]) => any): () => any {
    return () => {
      const value = this.instanceInjector.invoke(factoryFunction);

      if (value === undefined) {
        throw 'A factory must return a value.';
      }

      return value;
    }
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
    funcWithDependencies: IInjectableFunction | any[],
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
