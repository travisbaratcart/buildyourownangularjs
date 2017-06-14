'use strict';

export function setupModuleLoder(window: any): void {
  const angular = ensure(window, 'angular', () => new Angular());
}

function ensure (obj: any, name: string, factory: () => any): any {
  return obj[name] || (obj[name] = factory());
}

class Module {
  constructor(
    public name: string,
    public depenedencies: string[]) {

  }
}

class Angular {
  public module(moduleName: string, depenedencies: any[]): Module {
    return new Module(moduleName, depenedencies);
  }
}
