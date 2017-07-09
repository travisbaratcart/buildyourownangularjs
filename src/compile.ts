'use strict';
import { IProvider, IProvide } from './injector';
import { Injector } from './injector';
import * as _ from 'lodash';

export interface IDirective {

}

type DirectiveFactory = () => IDirective;

export interface IDirectiveFactoryObject {
  [directiveName: string]: DirectiveFactory
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

  private registeredDirectivesFactories: { [directiveName: string]: DirectiveFactory[] } = {};

  public directive(directiveNameOrObject: string | IDirectiveFactoryObject, directiveFactory: DirectiveFactory) {
    if (typeof directiveNameOrObject === 'string') {
      if (!this.registeredDirectivesFactories[directiveNameOrObject]) {
        this.configureDirectiveFactory(directiveNameOrObject);
      }

      this.registeredDirectivesFactories[directiveNameOrObject].push(directiveFactory);
    } else {
      _.forEach(directiveNameOrObject, (directiveFactory, directiveName) => {
        this.directive(directiveName, directiveFactory);
      });
    }
  }

  private configureDirectiveFactory(directiveName: string): void {
    this.registeredDirectivesFactories[directiveName] = [];

    this.$provide.factory(`${directiveName}Directive`, ['$injector', ($injector: Injector) => {
      const directiveFactories = this.registeredDirectivesFactories[directiveName];

      return directiveFactories.map(factory => $injector.invoke(factory));
    }]);
  }
}
