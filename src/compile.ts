'use strict';
import { IProvider, IProvide } from './injector';
import { Scope } from '../src/scope';
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

const BOOLEAN_ELEMENTS: any = {
  INPUT: true,
  SELECT: true,
  OPTION: true,
  TEXTAREA: true,
  BUTTON: true,
  FORM: true,
  DETAILS: true
};

const isBooleanAttribute = (nodeName: string, attributeName: string) => {
  return BOOLEAN_ELEMENTS[nodeName] && BOOLEAN_ATTRS[attributeName];
};

export interface IDirectiveDefinitionObject {
  compile?: (element?: JQuery, attrs?: Attributes) => any;
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

export class $CompileProvider implements IProvider {
  public $inject = [
    '$provide',
    '$injector'
  ];

  constructor(
    private $provide: IProvide) {

  }

  public $get = [
    '$injector',
    '$rootScope',
    function($injector: Injector, $rootScope: Scope) {
      return new $CompileService(
        $injector,
        $rootScope,
        this.registeredDirectivesFactories);
    }
  ];

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
    private $rootScope: Scope,
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
        let normalizedAttributeName = this.normalizeAttributeName(attr.name);

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

  private getAttrsForNode(node: HTMLElement): Attributes {
    const attrs = new Attributes($(node), this.$rootScope);

    _.forEach(node.attributes, (attr) => {
      const normalizedAttributeName = this
        .normalizeAttributeName(attr.name);

      const isNgAttr = this.isNgAttr(attr.name);

      if (isNgAttr || !attrs.hasOwnProperty(normalizedAttributeName)) {
        if (!isNgAttr) {
          attrs.$$attrNameMap[normalizedAttributeName] = attr.name;
        }

        (<any>attrs)[normalizedAttributeName] = this.getAttrValue(attr, node);
      }
    });

    return attrs;
  }

  private getAttrValue(attr: Attr, node: HTMLElement): any {
    return isBooleanAttribute(node.nodeName, attr.name)
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

  private applyDirectivesToNode(
    nodeDirectives: IDirectiveDefinitionObject[],
    compileNode: HTMLElement,
    attrs: Attributes) {
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

  private compileNode(
    directive: IDirectiveDefinitionObject,
    node: HTMLElement,
    attrs: Attributes) {
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

  private normalizeAttributeName(attrName: string): string {
    let normalizedAttributeName = this
      .normalizeName(attrName)
      .replace(/(Start|End)$/, '');

    const isNgAttr = this.isNgAttr(normalizedAttributeName);

    return isNgAttr
      ? normalizedAttributeName[6].toLowerCase()
        + normalizedAttributeName.substring(7)
      : normalizedAttributeName;
  }

  private isNgAttr(attrName: string) {
    return /^ngAttr[A-Z]/.test(attrName)
      || /^ng\-attr\-[A-z]/.test(attrName);
  }

  private nodeName(node: HTMLElement): string {
    return node.nodeName
  }

  private stripNgAttr(normalizedAttributeName: string): string {
    const isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttributeName);

    return normalizedAttributeName[6].toLowerCase()
      + normalizedAttributeName.substring(7);
  }
}

export class Attributes {
  public $$attrNameMap: { [normalizedAttributeName: string]: string } = {};
  private $$observers: { [attr: string]: ((value: any) => any)[] } = {};

  constructor(private $element: JQuery, private $rootScope: Scope) {
  }

  public $set(
    key: string,
    value: any,
    writeToDom = true,
    overrideAttrName: string = null) {
    (<any>this)[key] = value;

    if (isBooleanAttribute(this.$element.prop('tagName'), key)) {
      this.$element.prop(key, value);
    }

    if (overrideAttrName) {
      this.$$attrNameMap[key] = overrideAttrName;
    }

    let attributeName = overrideAttrName
      || this.$$attrNameMap[key]
      || (this.$$attrNameMap[key] = _.kebabCase(key));

    if (writeToDom) {
      this.$element.attr(overrideAttrName || attributeName, value);
    }

    this.callAttrObservers(key, value);
  }

  public $observe(key: string, cb: (value: any) => any): void {
    if (!this.$$observers[key]) {
      this.$$observers[key] = [];
    }

    this.$$observers[key].push(cb);

    this.$rootScope.$evalAsync(() => cb((<any>this)[key]));
  }

  private callAttrObservers(key: string, value: any) {
    if (this.$$observers[key]) {
      try {
        this.$$observers[key].forEach(observer => observer(value));
      } catch (error) {
        console.error(error);
      }
    }
  }
}
