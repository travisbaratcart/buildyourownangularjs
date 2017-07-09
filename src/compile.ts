'use strict';
import { IProvider, IProvide } from './injector';

export interface IDirective {

}

export class $CompileProvider implements IProvider {
  public $inject = [
    '$provide'
  ];

  constructor(
    private $provide: IProvide) {

  }

  public $get() {

  }

  public directive(directiveName: string, directiveFactory: () => IDirective) {
    this.$provide.factory(`${directiveName}Directive`, directiveFactory);
  }
}
