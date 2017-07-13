'use strict';
import { IProvider, IProvide } from './injector';
import { Injector } from './injector';
import * as _ from 'lodash';

const BOOLEAN_ATTRS: any = {
  multiple: true,
  selected: true,
  checked: true,
  disabled: true,
  readOnly: true,
  required: true,
  open: true
};

const BOOLEAN_ELEMENTS: any {
  INPUT: true,
  SELECT: true,
  OPTION: true,
  TEXTAREA: true,
  BUTTON: true,
  FORM: true,
  DETAILS: true
};

export interface IDirectiveDefinitionObject {
  compile?: (element?: JQuery, attrs?: IAttrObject) => any;
  restrict?: string;
  priority?: number;
  name?: string;
  index?: number;
  terminal?: boolean;
  multiElement?: boolean;
}

export type DirectiveFactory = () => IDirectiveDefinitionObject;

export interface IDirectiveFactoryObject {
  [directiveName: string]: DirectiveFactory
}

export interface IAttrObject {
  [attrName: string]: string;
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
      const nodeAttrs = this.getAttrsForNode(node);
      this.applyDirectivesToNode(nodeDirectives, node, nodeAttrs);

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
        let normalizedAttributeName = this
          .normalizeName(attr.name)
          .replace(/(Start|End)$/, '');

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

  private getAttrsForNode(node: HTMLElement): IAttrObject {
    const attrs: IAttrObject = {};

    _.forEach(node.attributes, (attr) => {
      let normalizedAttributeName = this
        .normalizeName(attr.name);

      attrs[normalizedAttributeName] = this.getAttrValue(attr, node);
    });

    return attrs;
  }

  private getAttrValue(attr: Attr, node: HTMLElement): any {
    const isBooleanAttribute = BOOLEAN_ELEMENTS[node.nodeName] && BOOLEAN_ATTRS[attr.name];

    return isBooleanAttribute
      ? true
      : attr.value.trim();
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

  private applyDirectivesToNode(nodeDirectives: IDirectiveDefinitionObject[], compileNode: HTMLElement, attrs: IAttrObject) {
    let terminalPriority = -1;

    nodeDirectives.forEach(directive => {
      if (directive.priority < terminalPriority) {
        return;
      }

      if (directive.terminal && directive.priority > terminalPriority) {
        terminalPriority = directive.priority;
      }

      if (directive.compile) {
        this.compileNode(directive, compileNode, attrs);
      }
    });
  }

  private compileNode(directive: IDirectiveDefinitionObject, node: HTMLElement, attrs: IAttrObject) {
    if (directive.multiElement) {
      const nodes = this.getMultiElementNodes(directive, node);

      if (nodes) {
        directive.compile(nodes, attrs);
      }
    } else {
      directive.compile($(node), attrs);
    }
  }

  private getMultiElementNodes(directive: IDirectiveDefinitionObject, startNode: HTMLElement): JQuery {
    const nodes = [];
    const startAttributeName = _.kebabCase(`${directive.name}Start`);
    const endAttributeName = _.kebabCase(`${directive.name}End`);

    if (!startNode.hasAttribute(startAttributeName)) {
      return;
    }

    let depth = 0;
    let searchNode = startNode;

    do {
      if (searchNode.nodeType === Node.ELEMENT_NODE) {
        if (searchNode.hasAttribute(startAttributeName)) {
          depth++;
        } else if (searchNode.hasAttribute(endAttributeName)) {
          depth--;
        }
      }

      nodes.push(searchNode);
      searchNode = <HTMLElement>searchNode.nextSibling;
    } while (depth > 0);

    return $(nodes);
  }

  private normalizeName(name: string): string {
    const PREFIX_REGEX = /(x[\:\-_]|data[\:\-_])/i;
    return _.camelCase(name.toLowerCase().replace(PREFIX_REGEX, ''));
  }

  private nodeName(node: HTMLElement): string {
    return node.nodeName
  }
}
