'use strict';
import { IProvider, IProvide, Invokable } from './injector';
import { Scope } from '../src/scope';
import { Injector } from './injector';
import { IParseService } from './parse';
import { ControllerFunction } from './controller';
import * as _ from 'lodash';

type LinkFunction = (scope?: Scope, element?: JQuery, attrs?: Attributes) => void;
interface ILinkFunctionObject {
  post?: LinkFunction;
  pre?: LinkFunction;
}

type NodeBoundLinkFn = (scope?: Scope) => void;
interface INodeBoundLinkFunctionObject {
  post?: NodeBoundLinkFn;
  pre?: NodeBoundLinkFn;
  createsNewScope?: boolean;
  isIsolateScope?: boolean;
  isolateBindings?: IIsolateBindingConfig;
  controller?: string | Invokable;
}

interface IIsolateBindingConfig {
  [scopeVariable: string]: {
    mode: string;
    collection: boolean;
    optional: boolean;
    attrName: string;
  }
}

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
  compile?: (element?: JQuery, attrs?: Attributes) => (LinkFunction | void);
  link?: LinkFunction | ILinkFunctionObject;
  restrict?: string;
  priority?: number;
  name?: string;
  index?: number;
  terminal?: boolean;
  multiElement?: boolean;
  scope?: any;
  $$isolateBindings?: any;
  controller?: string | Invokable;
  controllerAs?: string;
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
    '$controller',
    '$injector',
    '$parse',
    '$rootScope',
    function(
      $controller: ControllerFunction,
      $injector: Injector,
      $parse: IParseService,
      $rootScope: Scope) {
      return new $CompileService(
        $controller,
        $injector,
        $parse,
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

        if (typeof directive.scope === 'object') {
          directive.$$isolateBindings = this.parseIsolateBindings(directive.scope);
        }

        return directive;
      });
    }]);
  }

  private parseIsolateBindings(scopeConfig: any): IIsolateBindingConfig {
    const bindings: any = {};

    _.forEach(scopeConfig, (definition, scopeVariable) => {
      const targetAttrMatch = definition.match(/\s*([@&]|=(\*?))(\??)\s*(\w*)\s*/);

      bindings[scopeVariable] = {
        mode: targetAttrMatch[1][0],
        collection: targetAttrMatch[2] === '*',
        optional: targetAttrMatch[3],
        attrName: targetAttrMatch[4] || scopeVariable
      };
    });

    return bindings;
  }
}

export class $CompileService {

  constructor(
    private $controller: ControllerFunction,
    private $injector: Injector,
    private $parse: IParseService,
    private $rootScope: Scope,
    private registeredDirectivesFactories: { [directiveName: string]: DirectiveFactory[] }) {

  }

  public compile ($compileNodes: JQuery): (scope: Scope) => any {
    return this.compileNodes($compileNodes);
  }

  public compileNodes($compileNodes: JQuery) {
    const nodeLinkFns: NodeBoundLinkFn[] = [];

    _.forEach($compileNodes, (node, nodeIndex) => {
      const nodeDirectives = this.getDirectivesForNode(node);
      const nodeAttrs = this.getAttrsForNode(node);
      const { directiveLinkObjects, createsNewScope, controllerDirectives, isolateScopeDirective } = this.applyDirectivesToNode(nodeDirectives, node, nodeAttrs);
      const childLinkFns: NodeBoundLinkFn[] = [];

      const hasTerminalDirective = nodeDirectives.filter(directive => directive.terminal).length > 0;

      if (node.childNodes && node.childNodes.length && !hasTerminalDirective) {
        _.forEach(node.childNodes, (node) => {
          const childLinkFn = this.compileNodes($(node));

          if (childLinkFn) {
            childLinkFns.push(childLinkFn);
          }
        });
      }

      nodeLinkFns.push((scope: Scope) => {
        const isolateScope = scope.$new(true);

        const hasIsolateScopeDirectives = !!isolateScopeDirective;

        const nodeScope = createsNewScope
          ? scope.$new()
          : scope;

        const $node = $(node);
        $node.data('$scope', nodeScope);

        directiveLinkObjects.forEach(directiveLinkFnObject => {
          if (directiveLinkFnObject.pre) {
            const directiveScope = directiveLinkFnObject.isIsolateScope
              ? isolateScope
              : nodeScope;

            directiveLinkFnObject.pre(directiveScope);
          }
        });

        childLinkFns.forEach(childLinkFn => {
          childLinkFn(nodeScope);
        });

        _.forEachRight(directiveLinkObjects, directiveLinkFnObject => {
          if (directiveLinkFnObject.post) {
            const directiveScope = directiveLinkFnObject.isIsolateScope
              ? isolateScope
              : nodeScope;

            if (directiveLinkFnObject.isIsolateScope) {
              _.forEach(directiveLinkFnObject.isolateBindings, (definition, scopeVariable) => {
                const targetAttrName = definition.attrName;

                switch (definition.mode) {
                  case '@':
                    nodeAttrs.$observe(targetAttrName, (newAttrValue) => {
                      (<any>isolateScope)[scopeVariable] = newAttrValue;
                    });

                    if ((<any>nodeAttrs)[targetAttrName]) {
                      (<any>isolateScope)[scopeVariable] = (<any>nodeAttrs)[targetAttrName];
                    }

                    break;
                  case '=':
                    if (definition.optional && !(<any>nodeAttrs)[targetAttrName]) {
                      break;
                    }

                    const expression = this.$parse((<any>nodeAttrs)[targetAttrName]);

                    const initialParentValue = expression(nodeScope);
                    (<any>isolateScope)[scopeVariable] = initialParentValue;

                    let lastParentValue = initialParentValue;

                    // NOTE: Registering own change detection to be handled on every digest loop
                    const parentValueWatch = () => {
                      let parentValue = expression(nodeScope);

                      if((<any>isolateScope)[scopeVariable] !== parentValue) {
                        if (parentValue !== lastParentValue) {
                          (<any>isolateScope)[scopeVariable] = parentValue;
                        } else {
                          parentValue = (<any>isolateScope)[scopeVariable];
                          expression.assign(nodeScope, parentValue);
                        }
                      }

                      lastParentValue = parentValue;
                      return parentValue;
                    }

                    let unwatchFunc: () => any;

                    if (definition.collection) {
                      unwatchFunc = nodeScope.$watchCollection((<any>nodeAttrs)[targetAttrName], parentValueWatch);
                    } else {
                      unwatchFunc = scope.$watch(parentValueWatch);
                    }

                    isolateScope.$on('$destroy', unwatchFunc);

                    break;
                  case '&':
                    const evalExpression = this.$parse((<any>nodeAttrs)[targetAttrName]);

                    if (evalExpression === _.noop && definition.optional) {
                      break;
                    }

                    (<any>isolateScope)[scopeVariable] = (locals: any) => {
                      return evalExpression(nodeScope, locals);
                    }

                    break;
                  default:
                    throw 'CompileService.compileNodes: Unexpected scope configuration.'
                }
              });
            }

            directiveLinkFnObject.post(directiveScope);
          }
        });

        controllerDirectives.forEach(controllerDirective => {
          const controllerScope = isolateScopeDirective
            ? isolateScope
            : scope;

          const controllerLocals: any = {
            $scope: controllerScope,
            $element: $node,
            $attrs: nodeAttrs
          };

          if (controllerDirective.controller === '@') {
            this.$controller((<any>nodeAttrs)[controllerDirective.name], controllerLocals, false)
          } else {
            this.$controller(controllerDirective.controller, controllerLocals, false,  controllerDirective.controllerAs);
          }
        });
      });
    });

    return (scope: Scope) => {
      nodeLinkFns.forEach(nodeLinkFn => {
        nodeLinkFn(scope);
      });
    };
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

      _.forEach(this.getNodeClasses(node), (attrValue, normalizedClassName) => {
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

  private getNodeClasses(node: HTMLElement) {
    const classMap: { [className: string ]: string} = {};
    let classString = node.className;

    if (typeof classString === 'string' && classString !== '') {
      let match: RegExpExecArray;
      while ((match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(classString))) {
        const normalizedClassName = this.normalizeName(match[1]);
        const attributeValue = match[2] ? match[2].trim() : undefined;

        classMap[normalizedClassName] = attributeValue;

        // Get rid of this match from full string to prevent infinite loop
        classString = classString.substr(match.index + match[0].length);
      }
    }

    return classMap;
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

    _.forEach(this.getNodeClasses(node), (attrValue, normalizedClassName) => {
      if (this.getDirectivesByName(normalizedClassName, 'C').length) {
        (<any>attrs)[normalizedClassName] = attrValue;
      }
    });

    if (node.nodeType === Node.COMMENT_NODE) {
      const match = /^\s+directive\:\s*([\d\w\-_]+)\s*(.*)$/.exec(node.nodeValue);

      if (match) {
        const normalizedName = this.normalizeName(match[1]);

        if (this.getDirectivesByName(normalizedName, 'M').length) {
          (<any>attrs)[normalizedName] = match[2] ? match[2].trim() : undefined;
        }
      }
    }

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

    const directiveLinkObjects: INodeBoundLinkFunctionObject[] = [];

    let createsNewScope = false;
    const controllerDirectives: IDirectiveDefinitionObject[] = [];
    let isolateScopeDirective: IDirectiveDefinitionObject = null;

    nodeDirectives.forEach(directive => {
      if (directive.priority < terminalPriority) {
        return;
      }

      if (directive.terminal && directive.priority > terminalPriority) {
        terminalPriority = directive.priority;
      }

      const compileNodes = directive.multiElement
        ? this.getMultiElementNodes(directive, compileNode)
        : $(compileNode);

      if (directive.scope === true) {
        if (isolateScopeDirective) {
          throw 'CompileService.applyDirectivesToNode: Multiple directives asking for new/inherited scope';
        }

        createsNewScope = true;
      }

      if (typeof directive.scope === 'object') {
        if (isolateScopeDirective || createsNewScope) {
          throw 'CompileService.applyDirectivesToNode: Multiple directives asking for new/inherited scope';
        }

        isolateScopeDirective = directive
        compileNodes.addClass('ng-isolate-scope');
      }

      if (createsNewScope) {
        compileNodes.addClass('ng-scope');
      }

      const directiveLinkFunctionOrObject =
        (directive.compile && this.compileNode(directive, compileNodes, attrs))
        || directive.link;

      const directiveIsIsolateScope = typeof directive.scope === 'object';

      const nodeBoundLinkFnObject = this.getNodeBoundLinkFnObject(
        compileNodes,
        directiveLinkFunctionOrObject,
        attrs,
        createsNewScope,
        directiveIsIsolateScope,
        directive.$$isolateBindings);

      if (nodeBoundLinkFnObject) {
        directiveLinkObjects.push(nodeBoundLinkFnObject);
      }

      if (directive.controller) {
        controllerDirectives.push(directive);
      }
    });

    return {
      directiveLinkObjects,
      createsNewScope,
      controllerDirectives,
      isolateScopeDirective
    };
  }

  private getNodeBoundLinkFnObject(
        compileNodes: JQuery,
        directiveLinkFunctionOrObject: LinkFunction | ILinkFunctionObject,
        attrs: Attributes,
        createsNewScope: boolean,
        isIsolateScope: boolean,
        directiveIsolateBindings: any): INodeBoundLinkFunctionObject {
    if (!compileNodes || !directiveLinkFunctionOrObject) {
      return;
    }

    const scopeAttrName = isIsolateScope
      ? '$isolateScope'
      : '$scope';

    if (typeof directiveLinkFunctionOrObject === 'object') {
      return {
        pre: (scope: Scope) => {
          if (directiveLinkFunctionOrObject.pre) {
            compileNodes.data(scopeAttrName, scope);
            directiveLinkFunctionOrObject.pre(scope, compileNodes, attrs);
          }
        },
        post: (scope: Scope) => {
          if (directiveLinkFunctionOrObject.post) {
            directiveLinkFunctionOrObject.post(scope, compileNodes, attrs);
          }
        },
        createsNewScope,
        isIsolateScope,
        isolateBindings: directiveIsolateBindings
      }
    } else if (typeof directiveLinkFunctionOrObject === 'function') {
      return {
        post: (scope: Scope) => {
          compileNodes.data(scopeAttrName, scope);
          directiveLinkFunctionOrObject(scope, compileNodes, attrs);
        },
        createsNewScope,
        isIsolateScope,
        isolateBindings: directiveIsolateBindings
      }
    }
  }

  private compileNode(
    directive: IDirectiveDefinitionObject,
    node: JQuery,
    attrs: Attributes): (LinkFunction | ILinkFunctionObject | void) {
    if (!node) {
      return;
    }

    return directive.compile(node, attrs);
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

  public $observe(key: string, cb: (value: any) => any): Function {
    if (!this.$$observers[key]) {
      this.$$observers[key] = [];
    }

    this.$$observers[key].push(cb);

    this.$rootScope.$evalAsync(() => cb((<any>this)[key]));

    return () => {
      const observerIndex = this.$$observers[key].indexOf(cb);
      if (observerIndex > -1) {
        this.$$observers[key].splice(observerIndex, 1);
      }
    };
  }

  public $addClass(className: string) {
    this.$element.addClass(className);
  }

  public $removeClass(className: string) {
    this.$element.removeClass(className);
  }

  public $updateClass(newClassesString: string, oldClassesString: string) {
    const newClasses = newClassesString.split(/\s+/);
    const oldClasses = oldClassesString.split(/\s+/);

    const addedClasses = _.difference(newClasses, oldClasses);
    const removedClasses = _.difference(oldClasses, newClasses);

    if (addedClasses.length) {
      this.$addClass(addedClasses.join(' '));
    }

    if (removedClasses.length) {
      this.$removeClass(removedClasses.join(' '));
    }
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
