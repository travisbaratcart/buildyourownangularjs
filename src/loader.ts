'use strict';

export function setupModuleLoder(window: any): void {
  const angular = ensure(window, 'angular', () => new Angular());
}

function ensure (obj: any, name: string, factory: () => any): any {
  return obj[name] || (obj[name] = factory());
}

class Module {
  constructor(
    private name: string) {

  }
}

class Angular {
  public module(moduleName: string): Module {
    return new Module(moduleName);
  }
}
