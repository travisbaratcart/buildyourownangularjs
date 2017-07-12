'use strict';
import { IProvider, IProvide } from './injector';
import { Injector } from './injector';
import * as _ from 'lodash';

export interface IDirectiveDefinitionObject {
  compile?: (element?: JQuery) => any;
  restrict?: string;
  priority?: number;
  name?: string;
  index?: number;
  terminal?: boolean;
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

      return directiveFactories.map((factory, index) => {
        const directive = $injector.invoke(factory);

        directive.restrict = directive.restrict || 'EA';
        directive.priority = directive.priority || 0;
        directive.name = directive.name || directiveName;
        directive.index = index;

        return directive;
      });
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

      const hasTerminalDirective = nodeDirectives.filter(directive => directive.terminal).length > 0;

      if (node.childNodes && node.childNodes.length && !hasTerminalDirective) {
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
      directives = directives.concat(this.getDirectivesByName(normalizedNodeName, 'E'));

      _.forEach(node.attributes, (attr) => {
        let normalizedAttributeName = this.normalizeName(attr.name);

        if (/^ngAttr[A-Z]/.test(normalizedAttributeName)) {
          normalizedAttributeName = normalizedAttributeName[6].toLowerCase()
          + normalizedAttributeName.substring(7);
        }

        directives = directives.concat(this.getDirectivesByName(normalizedAttributeName, 'A'));
      });

      _.forEach(node.classList, (nodeClass) => {
        const normalizedClassName = this.normalizeName(nodeClass);
        directives = directives.concat(this.getDirectivesByName(normalizedClassName, 'C'));
      });
    } else if (node.nodeType === Node.COMMENT_NODE) {
      const match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);

      if (match) {
        const normalizedMatch = this.normalizeName(match[1]);
        directives = directives.concat(this.getDirectivesByName(normalizedMatch, 'M'));
      }
    }

    directives
      .sort(this.directivePriority);

    return directives;
  }

  private getDirectivesByName(directiveName: string, nodeType: string): IDirectiveDefinitionObject[] {
    const foundDirectives: IDirectiveDefinitionObject[] = this.registeredDirectivesFactories[directiveName]
      ? this.$injector.get(`${directiveName}Directive`)
      : <IDirectiveDefinitionObject[]>[];

    const applicableDirectives = foundDirectives.filter(directive => directive.restrict.indexOf(nodeType) > -1);

    return applicableDirectives;
  }

  private directivePriority(
    directiveA: IDirectiveDefinitionObject,
    directiveB: IDirectiveDefinitionObject): number {

    const priorityDifference = directiveB.priority - directiveA.priority;

    if (priorityDifference) {
      return priorityDifference;
    }

    if (directiveA.name !== directiveB.name) {
      return (directiveA.name < directiveB.name ? -1 : 1);
    }

    return directiveA.index - directiveB.index;
  }

  private applyDirectivesToNode(nodeDirectives: IDirectiveDefinitionObject[], compileNode: HTMLElement) {
    const $compileNode = $(compileNode);

    let terminalPriority = -1;

    nodeDirectives.forEach(directive => {
      if (directive.priority < terminalPriority) {
        return;
      }

      if (directive.terminal && directive.priority > terminalPriority) {
        terminalPriority = directive.priority;
      }

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
