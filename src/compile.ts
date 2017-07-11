'use strict';
import { IProvider, IProvide } from './injector';
import { Injector } from './injector';
import * as _ from 'lodash';

export interface IDirectiveDefinitionObject {
  compile?: (element?: JQuery) => any;
}

export type DirectiveFactory = () => IDirectiveDefinitionObject;

export interface IDirectiveFactoryObject {
  [directiveName: string]: DirectiveFactory
}

export class $CompileProvider implements IProvider {
  public $inject = [
    '$provide',
    '$injector'
  ];

  constructor(
    private $provide: IProvide) {

  }

  public $get = ['$injector', function($injector: Injector) {
    return new $CompileService(
      $injector,
      this.registeredDirectivesFactories);
  }];

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

export class $CompileService {

  constructor(
    private $injector: Injector,
    private registeredDirectivesFactories: { [directiveName: string]: DirectiveFactory[] }) {

  }

  public compile($compileNodes: JQuery) {
    _.forEach($compileNodes, (node) => {
      const nodeDirectives = this.getDirectivesForNode(node);
      this.applyDirectivesToNode(nodeDirectives, node);

      if (node.childNodes && node.childNodes.length) {
        _.forEach(node.childNodes, (node) => {
          this.compile($(node));
        });
      }
    });
  }

  private getDirectivesForNode(node: HTMLElement): IDirectiveDefinitionObject[] {
    let directives: IDirectiveDefinitionObject[] = [];

    if (node.nodeType === Node.ELEMENT_NODE) {
      const normalizedNodeName = this.normalizeName(this.nodeName(node));
      directives = directives.concat(this.getDirectivesByName(normalizedNodeName));

      _.forEach(node.attributes, (attr) => {
        let normalizedAttributeName = this.normalizeName(attr.name);

        if (/^ngAttr[A-Z]/.test(normalizedAttributeName)) {
          normalizedAttributeName = normalizedAttributeName[6].toLowerCase()
          + normalizedAttributeName.substring(7);
        }

        directives = directives.concat(this.getDirectivesByName(normalizedAttributeName));
      });

      _.forEach(node.classList, (nodeClass) => {
        const normalizedClassName = this.normalizeName(nodeClass);
        directives = directives.concat(this.getDirectivesByName(normalizedClassName));
      });
    } else if (node.nodeType === Node.COMMENT_NODE) {
      const match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);

      if (match) {
        const normalizedMatch = this.normalizeName(match[1]);
        directives = directives.concat(this.getDirectivesByName(normalizedMatch));
      }
    }

    return directives;
  }

  private getDirectivesByName(directiveName: string): IDirectiveDefinitionObject[] {
    return this.registeredDirectivesFactories[directiveName]
      ? this.$injector.get(`${directiveName}Directive`)
      : <IDirectiveDefinitionObject[]>[];
  }

  private applyDirectivesToNode(nodeDirectives: IDirectiveDefinitionObject[], compileNode: HTMLElement) {
    const $compileNode = $(compileNode);

    nodeDirectives.forEach(directive => {
      if (directive.compile) {
        directive.compile($compileNode);
      }
    });
  }

  private normalizeName(name: string): string {
    const PREFIX_REGEX = /(x[\:\-_]|data[\:\-_])/i;
    return _.camelCase(name.toLowerCase().replace(PREFIX_REGEX, ''));
  }

  private nodeName(node: HTMLElement): string {
    return node.nodeName
  }
}
