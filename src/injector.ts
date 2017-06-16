'use strict';
import { Angular, RegisterType } from './loader';

export function createInjector(modulesToLoad: string[]): any {
  return new Injector(modulesToLoad);
}

class Injector {
  private cache: any = {};

  constructor(modulesToLoad: string[]) {
    modulesToLoad.forEach(moduleName => {
      const module = (<Angular>(<any>window).angular).module(moduleName);

      module.$$invokeQueue.forEach(registerItem => {
        this.$provide(registerItem.type)(registerItem.key, registerItem.value);
      });
    });
  }

  public has(key: string): boolean {
    return this.cache.hasOwnProperty(key);
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
