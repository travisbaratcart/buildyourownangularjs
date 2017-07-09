'use strict';
import { IProvider, IProvide } from './injector';
import { Injector } from './injector';

export interface IDirective {

}

type DirectiveFactory = () => IDirective;

export class $CompileProvider implements IProvider {
  public $inject = [
    '$provide'
  ];

  constructor(
    private $provide: IProvide) {

  }

  public $get() {

  }

  private registeredDirectivesFactories: { [directiveName: string]: DirectiveFactory[] } = {};

  public directive(directiveName: string, directiveFactory: DirectiveFactory) {
    if (!this.registeredDirectivesFactories[directiveName]) {
      this.configureDirectiveFactory(directiveName);
    }

    this.registeredDirectivesFactories[directiveName].push(directiveFactory);
  }

  private configureDirectiveFactory(directiveName: string): void {
    this.registeredDirectivesFactories[directiveName] = [];

    this.$provide.factory(`${directiveName}Directive`, ['$injector', ($injector: Injector) => {
      const directiveFactories = this.registeredDirectivesFactories[directiveName];

      return directiveFactories.map(factory => $injector.invoke(factory));
    }]);
  }
}
