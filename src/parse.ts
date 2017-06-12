import * as _ from 'lodash';
import { FilterService } from './filter';
import { Scope } from '../src/scope';

interface IToken {
  text: string;
  value?: any;
  isIdentifier: boolean
}

enum ASTComponents {
  NotSpecified,
  Program,
  Literal,
  ArrayExpression,
  ObjectExpression,
  ObjectProperty,
  Identifier,
  ThisExpression,
  MemberExpression,
  CallExpression,
  AssignmentExpression,
  UnaryExpression,
  BinaryExpression,
  LogicalExpression,
  ConditionalExpression
};

enum CompileStage {
  Inputs,
  Main
}

interface IParseResult {
  (context?: any, locals?: any): any,
  literal: boolean,
  constant: boolean,
  inputs: any[],
  $$watchDelegate(
    scope: Scope,
    listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
    checkValueEquality: boolean,
    watchFunction: (scope: Scope) => any): () => void
};

export function parse(expression?: string | ((context?: any, locals?: any) => any)): IParseResult {
  switch (typeof expression) {
    case 'string':
      let lexer = new Lexer();
      let parser = new Parser(lexer);

      let stringExpression = <string>expression;

      const isOneTimeExpression = stringExpression.charAt(0) === ':'
        && stringExpression.charAt(1) === ':';

      const processedExpression = isOneTimeExpression
        ? stringExpression.substring(2)
        : stringExpression;

      const parseFunction = parser.parse(processedExpression);

      if (parseFunction.constant) {
        parseFunction.$$watchDelegate = constantWatchDelegate;
      } else if (isOneTimeExpression) {
        // Order important. Constant, one-time, literal expressions
        // already handled by constant condition above.
        parseFunction.$$watchDelegate = parseFunction.literal
          ? oneTimeArrOrObjWatchDelegate
          : oneTimeWatchDelegate;
      } else if (parseFunction.inputs && parseFunction.inputs.length > 0) {
        parseFunction.$$watchDelegate = inputsWatchDelegate;
      }

      return parseFunction
    case 'function':
      return <IParseResult>expression;
    default:
      let result = <IParseResult>_.noop;
      result.literal = true;
      result.constant = true;

      return result;
  }
}

function constantWatchDelegate(
  scope: Scope,
  listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
  checkValueEquality: boolean,
  watchFunction: IParseResult) {

  const unWatch = scope.$watch(
    () => watchFunction(scope),
    (newValue, oldValue, scope) => {
      if (_.isFunction(listenerFunction)) {
        listenerFunction(newValue, oldValue, scope);
      }

      unWatch();
    }, checkValueEquality);

  return unWatch;
}

function oneTimeWatchDelegate(
  scope: Scope,
  listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
  checkValueEquality: boolean,
  watchFunction: IParseResult) {

  let finalValue: any;

  const unWatch = scope.$watch(
    () => watchFunction(scope),
    (newValue, oldValue, scope) => {
      finalValue = newValue;

      if (_.isFunction(listenerFunction)) {
        listenerFunction(newValue, oldValue, scope);
      }

      if (newValue !== undefined) {
        scope.$$postDigest(() => {
          if (finalValue !== undefined) {
            unWatch();
          }
        })
      }
    }, checkValueEquality);

  return unWatch;
}

function oneTimeArrOrObjWatchDelegate(
  scope: Scope,
  listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
  checkValueEquality: boolean,
  watchFunction: IParseResult) {

  function areAllDefined(arrOrObj: any) {
    return _.every(arrOrObj, (val) => !_.isUndefined(val));
  }

  const unWatch = scope.$watch(
    () => watchFunction(scope),
    (newValue, oldValue, scope) => {
      if (_.isFunction(listenerFunction)) {
        listenerFunction(newValue, oldValue, scope);
      }

      if (areAllDefined(newValue)) {
        scope.$$postDigest(() => {
          if (areAllDefined(newValue)) {
            unWatch();
          }
        })
      }
    }, checkValueEquality);

  return unWatch;
}

function inputsWatchDelegate(
  scope: Scope,
  listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
  checkValueEquality: boolean,
  watchFunction: IParseResult) {

  const inputExpressions = watchFunction.inputs;

  const oldValues = _.times(inputExpressions.length, () => () => null);
  let lastResult: any;

  return scope.$watch(() => {
    let changed = false;

    inputExpressions.forEach((inputExpression: any, i: number) => {
      const newValue = inputExpression(scope);

      if (didValueChange(newValue, oldValues[i])) {
        changed = true;
        oldValues[i] = newValue;
      }
    });

    if (changed) {
      lastResult = watchFunction(scope);
    }

    return lastResult;
  }, listenerFunction, checkValueEquality);
}

function didValueChange(newValue: any, oldValue: any): boolean {
  return newValue !== oldValue && !(newValue === NaN && oldValue === NaN);
}

class Lexer {
  private text: string;
  private currentCharIndex: number;
  private tokens: IToken[] = [];

  private OPERATORS: {[operator: string]: boolean} = {
    '+': true,
    '!': true,
    '-': true,
    '*': true,
    '/': true,
    '%': true,
    '=': true,
    '==': true,
    '!=': true,
    '===': true,
    '!==': true,
    '<': true,
    '>': true,
    '<=': true,
    '>=': true,
    '&&': true,
    '||': true,
    '|': true
  };

  public lex(text: string): IToken[] {
    this.text = text;

    this.currentCharIndex = 0;

    while (this.currentCharIndex < this.text.length) {
      const currentChar = this.text[this.currentCharIndex];
      const nextChar = this.peekChar();

      if (this.isBeginningOfNumber(currentChar, nextChar)) {
        this.readNumber();
      } else if (this.isBeginningOfString(currentChar)) {
        this.readString();
      } else if (this.is(currentChar, '[],{}:.()?;')) {
        this.addToken(currentChar);
        this.currentCharIndex++;
      } else if (this.isIdentifierComponent(currentChar)) {
        this.readIdentifier();
      } else if (this.isCharWhitespace(currentChar)) {
        this.currentCharIndex++
      } else {
        const currentTwoChars = currentChar + this.peekChar();
        const currentThreeChars = currentTwoChars + this.peekChar(2);

        const isOneCharOperator = this.OPERATORS[currentChar];
        const isTwoCharOperator = this.OPERATORS[currentTwoChars];
        const isThreeCharOperator = this.OPERATORS[currentThreeChars];

        if (isThreeCharOperator) {
          this.addToken(currentThreeChars);
          this.currentCharIndex += 3;
        } else if (isTwoCharOperator) {
          this.addToken(currentTwoChars);
          this.currentCharIndex += 2;
        } else if (isOneCharOperator) {
          this.addToken(currentChar);
          this.currentCharIndex += 1;
        } else {
          throw `Unexpected next character: ${this.text[this.currentCharIndex]}`;
        }
      }
    }

    return this.tokens;
  }

  private readNumber(): void {
    let numberText = '';
    while (this.currentCharIndex < this.text.length) {
      let currentChar = this.text[this.currentCharIndex].toLowerCase();

      if (this.isCharNumber(currentChar) || currentChar === '.') {
        numberText += currentChar;
      } else {
        // Exponent handling eg 4e12, 4E12,
        const nextChar = this.peekChar();
        const lastChar = numberText.charAt(numberText.length - 1);

        if (currentChar === 'e' && this.isExponentOperator(nextChar)) {
          numberText += currentChar
        } else if (this.isExponentOperator(currentChar)
          && lastChar === 'e'
          && nextChar
          && this.isCharNumber(nextChar)) {
          numberText += currentChar;
        } else if (this.isExponentOperator(currentChar) && lastChar === 'e'
          && (!nextChar || !this.isCharNumber(nextChar))) {
          throw 'Invalid exponent';
        } else {
          break;
        }
      }

      this.currentCharIndex++;
    }

    this.addToken(numberText, Number(numberText), false);
  }

  private readString(): void {
    const ESCAPES: {[char: string]: string} = {
      'n': '\n',
      'f': '\f',
      'r': '\r',
      't': '\t',
      'v': '\v',
      '\'': '\'',
      '"': '\"'
    };

    let openingQuote = this.text[this.currentCharIndex];

    let string = '';

    let rawString = openingQuote;

    this.currentCharIndex++ // move past opening quote

    while (this.currentCharIndex < this.text.length) {
      let currentChar = this.text[this.currentCharIndex];
      rawString += currentChar;

      if (currentChar === '\\') {
        const nextChar = this.peekChar();

        const escapeChar = ESCAPES[nextChar];

        if (nextChar === 'u') {
          const hex = this.text.substring(this.currentCharIndex + 2, this.currentCharIndex + 6);

          if (!hex.match(/[\da-f]{4}/i)) {
            throw 'Invalid unicode escape';
          }

          this.currentCharIndex += 6;
          string += String.fromCharCode(parseInt(hex, 16));
        } else if (escapeChar) {
          string += escapeChar;
          this.currentCharIndex += 2;
        } else {
          string += this.peekChar();
          this.currentCharIndex += 2;
        }
      } else if (currentChar === openingQuote) {
        this.currentCharIndex++;
        this.addToken(rawString, string);
        return;
      } else {
        string += currentChar;
        this.currentCharIndex++;
      }
    }

    throw 'Unmatched quote';
  }

  private readIdentifier(): void {
    let result = '';

    while (this.currentCharIndex < this.text.length) {
      const currentChar = this.text.charAt(this.currentCharIndex);

      if (this.isIdentifierComponent(currentChar) || this.isCharNumber(currentChar)) {
        result += currentChar;
      } else {
        break;
      }

      this.currentCharIndex++;
    }

    this.addToken(result, null, true);
  }

  private addToken(text: string, value?: any, isIdentifier = false): void {
    let newToken: IToken = { text, value, isIdentifier };

    this.tokens.push(newToken);
  }

  private isBeginningOfNumber(char: string, nextChar: string): boolean {
    return this.isCharNumber(char) || (char ===  '.' &&  this.isCharNumber(nextChar));
  }

  private isBeginningOfString(char: string): boolean {
    return char === '\'' || char === '"';
  }

  private isIdentifierComponent(char: string): boolean {
    return ('a' <= char && char <= 'z')
      || ('A' <= char && char <= 'Z')
      || char === '_' || char === '$';
  }

  private isCharNumber(char: string): boolean {
    return '0' <= char && char <= '9';
  }

  private isCharWhitespace(char: string): boolean {
    return char === ' ' || char === '\r' || char === '\t'
      || char === '\n' || char === '\v' || char === '\u00A0';
  }

  private is(char: string, chars: string): boolean {
    return chars.indexOf(char) > -1;
  }

  private peekChar(skipChars = 1): string {
    return this.currentCharIndex < this.text.length - skipChars
      ? this.text.charAt(this.currentCharIndex + skipChars)
      : null;
  }

  private isExponentOperator(char: string) {
    return char === '-' || char === '+' || this.isCharNumber(char);
  }
}

class AST {
  private tokens: IToken[];

  constructor(
    private lexer: Lexer) {
  }

  public ast(text: string) {
    this.tokens = this.lexer.lex(text);

    return this.program();
  }

  private program() {
    const body: any[] = [];
    do {
      if (this.tokens.length) {
        body.push(this.filter());
      }
    } while (this.expect(';'));

    return {
      type: ASTComponents.Program,
      body
    };
  }

  private primary(): any {
    let primary: any;

    if (this.expect('(')) {
      primary = this.filter();
      this.consume(')');
    } else if (this.expect('[')) {
      primary = this.arrayDeclaration();
    } else if (this.expect('{')) {
      primary = this.object();
    } else if (this.peekNextToken().isIdentifier) {
      primary = this.identifier();
    } else {
      primary = this.constant();
    }

    let nextToken: IToken;
    while (nextToken = this.expect('.', '[', '(')) {
      if (nextToken.text === '[') {
        primary = {
          type: ASTComponents.MemberExpression,
          object: primary,
          property: this.primary(),
          isComputed: true
        }

        this.consume(']');
      } else if (nextToken.text === '.') {
        primary = {
          type: ASTComponents.MemberExpression,
          object: primary,
          property: this.identifier(),
          isComputed: false
        }
      } else if (nextToken.text === '(') {
        primary = {
          type: ASTComponents.CallExpression,
          callee: primary,
          arguments: this.arguments()
        };

        this.consume(')');
      }
    }

    return primary;
  }

  private assignment(): any {
    const left = this.ternary();

    if (this.expect('=')) {
      const right = this.ternary();
      return {
        type: ASTComponents.AssignmentExpression,
        left: left,
        right: right
      };
    }

    return left;
  }

  private constant() {
    return {
      type: ASTComponents.Literal,
      value: this.peekNextToken().isIdentifier
        ? eval(this.consume().text)
        : this.consume().value
    };
  }

  private arrayDeclaration(): any {
    const elements = [];

    if (this.peekNextToken() && this.peekNextToken().text !== ']') {
      do {
        if (this.peekNextToken(']')) {
          break;
        }

        elements.push(this.assignment());
      } while (this.expect(','))
    }

    this.consume(']');

    return {
      type: ASTComponents.ArrayExpression,
      elements: elements
    };
  }

  private object(): any {
    const properties: any[] = [];

    if (this.peekNextToken().text !== '}') {
      do {
        const property: any = {
          type: ASTComponents.ObjectProperty,
          key: this.peekNextToken().isIdentifier
            ? this.identifier()
            : this.constant()
        };

        this.consume(':');

        property.value = this.assignment()

        properties.push(property);
      } while(this.expect(','))
    }

    this.consume('}');
    return {
      type: ASTComponents.ObjectExpression,
      properties: properties
    };
  }

  private identifier(): any {
    return {
      type: ASTComponents.Identifier,
      name: this.consume().text
    };
  }

  private arguments(): any[] {
    const args: any[] = [];

    if (!this.peekNextToken(')')) {
      do {
        args.push(this.primary());
      } while (this.expect(','));
    }

    return args;
  }

  private unary(): any {
    const token = this.expect('+', '!', '-');

    if (token) {
      return {
        type: ASTComponents.UnaryExpression,
        operator: token.text,
        argument: this.unary()
      };
    } else {
      return this.primary();
    }
  }

  private multiplicative(): any {
    let result = this.unary();

    let expectedToken: IToken;

    while (expectedToken = this.expect('*', '/', '%')) {
      result = {
        type: ASTComponents.BinaryExpression,
        operator: expectedToken.text,
        left: result,
        right: this.unary()
      };
    }

    return result;
  }

  private additive(): any {
    let result = this.multiplicative();

    let expectedToken: IToken;

    while (expectedToken = this.expect('-', '+')) {
      result = {
        type: ASTComponents.BinaryExpression,
        operator: expectedToken.text,
        left: result,
        right: this.multiplicative()
      };
    }

    return result;
  }

  private equality(): any {
    let result = this.relational();

    let expectedToken: IToken;

    while (expectedToken = this.expect('==', '!=', '===', '!==')) {
      result = {
        type: ASTComponents.BinaryExpression,
        operator: expectedToken.text,
        left: result,
        right: this.relational()
      };
    }

    return result;
  }

  private relational(): any {
    let result = this.additive();

    let expectedToken: IToken;

    while (expectedToken = this.expect('<', '>', '<=', '>=')) {
      result = {
        type: ASTComponents.BinaryExpression,
        operator: expectedToken.text,
        left: result,
        right: this.additive()
      };
    }

    return result;
  }

  private logicalOR(): any {
    let result = this.logicalAND();

    let expectedToken: IToken;

    while (expectedToken = this.expect('||')) {
      result = {
        type: ASTComponents.LogicalExpression,
        operator: expectedToken.text,
        left: result,
        right: this.logicalAND()
      };
    }

    return result;
  }

  private logicalAND(): any {
    let result = this.equality();

    let expectedToken: IToken;

    while (expectedToken = this.expect('&&')) {
      result = {
        type: ASTComponents.LogicalExpression,
        operator: expectedToken.text,
        left: result,
        right: this.equality()
      };
    }

    return result;
  }

  private ternary(): any {
    let test = this.logicalOR();

    if (this.expect('?')) {
      const consequent = this.assignment();

      if (this.consume(':')) {
        const alternate = this.assignment();

        return {
          type: ASTComponents.ConditionalExpression,
          test,
          consequent,
          alternate
        }
      }
    }

    return test;
  }

  private filter(): any {
    let result = this.assignment();

    while (this.expect('|')) {
      const args = [result];

      result = {
        type: ASTComponents.CallExpression,
        callee: this.identifier(),
        arguments: args,
        filter: true
      };

      while (this.expect(':')) {
        args.push(this.assignment());
      }
    }

    return result;
  }

  private expect1(char?: string): IToken {
    if (!char || this.peekNextToken(char)) {
      return this.tokens.shift();
    }
  }

  private expect(...chars: string[]): IToken {
    if (!chars || chars.length === 0 || this.peekNextToken(...chars)) {
      return this.tokens.shift();
    }
  }

  private consume(char?: string): IToken {
    const token = char
      ? this.expect(char)
      : this.expect();

    if (!token) {
      throw `Unexpected. Expecting: ${char}`;
    }

    return token;
  }

  private peekNextToken(...limitChars: string[]) {
    if (this.tokens.length > 0) {
      const nextToken = this.tokens[0];

      if (limitChars && limitChars.length > 0) {
        return limitChars.filter(arg => arg === nextToken.text).length > 0
        ? nextToken
        : null;
      } else {
        return this.tokens[0];
      }
    }
  }
}

class ASTCompiler {
  private state: any;
  private stringEscapeRegex = /[^a-zA-Z0-9]/g
  private stage: CompileStage;

  private nextId = 0;

  constructor(
    private astBuilder: AST) {

  }

  public compile(text: string): IParseResult {
    let ast = this.astBuilder.ast(text);

    this.state = {
      func: {
        body: [],
        vars: [],
      },
      filters: {},
      computingNode: '',
      inputs: []
    };

    this.stage = CompileStage.Inputs

    this.findTopLevelWatchInputs(ast.body).forEach((input: any, i: number) => {
      const inputKey = `fn${i}`;
      this.state[inputKey] = { body: [], vars: [] };
      this.state.computingNode = inputKey;
      this.state[inputKey].body.push(`return ${this.recurse(input)};`);
      this.state.inputs.push(inputKey);
    });

    this.stage = CompileStage.Main;
    this.state.computingNode = 'func';

    this.recurse(ast);

    const filterPrefix = this.filterPrefix();

    const varsDeclaration = this.state.func.vars.length
      ? `var ${this.state.func.vars.join(',')};`
      : '';

    const functionBody = varsDeclaration + this.state.func.body.join('');

    const functionString = filterPrefix
      + 'var fn = function(scope, locals){'
      + varsDeclaration
      + functionBody
      + '};'
      + this.getWatchFunctions()
      + 'return fn;'

    const result = new Function(
      'validateAttributeSafety',
      'validateObjectSafety',
      'validateFunctionSafety',
      'ifDefined',
      'filterService',
      functionString)(
        this.validateAttributeSafety,
        this.validateObjectSafety,
        this.validateFunctionSafety,
        this.ifDefined,
        FilterService.getInstance()
      );

    result.constant = this.isConstant(ast);
    result.literal = this.isLiteral(ast);

    return result;
  }

  private recurse(ast: any, context?: any, safeTraverse?: boolean): any {
    switch (ast.type) {
      case ASTComponents.Program:
        ast.body.forEach((statement: any) => {
          const isLastElement = ast.body.indexOf(statement) === ast.body.length - 1;

          isLastElement
            ? this.state[this.state.computingNode].body.push('return ', this.recurse(statement), ';')
            : this.state[this.state.computingNode].body.push(this.recurse(statement) + ';');
        });

        break;
      case ASTComponents.Literal:
        return this.escapeIfNecessary(ast.value);
      case ASTComponents.ArrayExpression:
        const elements = ast.elements.map((element: any) => {
          return this.recurse(element);
        });
        return `[${elements.join(',')}]`;
      case ASTComponents.ObjectExpression:
        const properties = ast.properties.map((property: any) => {
          const key = property.key.type === ASTComponents.Identifier
            ? property.key.name
            : this.escapeIfNecessary(property.key.value);

          const value = this.recurse(property.value);

          return `${key}: ${value}`;
        });
        return `{ ${properties.join(',')} }`;
      case ASTComponents.Identifier:
        return this.getIdentifier(ast.name, context, safeTraverse);
      case ASTComponents.MemberExpression:
        return this.getMemberExpression(ast, context, safeTraverse);
      case ASTComponents.CallExpression:
        return this.getCallExpression(ast);
      case ASTComponents.AssignmentExpression:
        const leftContext: any = {};
        this.recurse(ast.left, leftContext, true);

        const leftSide = leftContext.isComputed
          ? this.lookupComputedPropertyOnObject(leftContext.context, leftContext.name)
          : this.lookupPropertyOnObject(leftContext.context, leftContext.name);

        return this.assign(
          leftSide,
          `validateObjectSafety(${this.recurse(ast.right)})`);
      case ASTComponents.UnaryExpression:
        return `${ast.operator}(${this.addIfDefined(this.recurse(ast.argument), 0)})`;
      case ASTComponents.BinaryExpression:
        const isAdditiveOperation = ast.operator === '+' || ast.operator === '-';
        return isAdditiveOperation
          ? this.getAdditiveOperation(ast)
          : this.getMultiplicativeOperation(ast);
      case ASTComponents.LogicalExpression:
        let nextId = this.getNextDistinctVariableName()  ;
        this.state[this.state.computingNode].body.push(this.assign(nextId, this.recurse(ast.left)));

        this.if_(ast.operator === '&&' ? nextId : this.not(nextId),
          this.assign(nextId, this.recurse(ast.right)));

        return nextId;
      case ASTComponents.ConditionalExpression:
        return this.getConditionalExpression(ast);
      default:
        throw 'Invalid syntax component.'
    }
  }

  private escapeIfNecessary(value: any): any {
    if (typeof value === 'string') {
      return `'${value.replace(this.stringEscapeRegex, this.stringEscapeFunc)}'`;
    } else if (value === null) {
      return 'null';
    } else {
      return value;
    }
  }

  private stringEscapeFunc(char: string): string {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
  }

  private getIdentifier(rawIdentifier: string, context?: any, safeTraverse?: boolean): string {
    this.validateAttributeSafety(rawIdentifier);

    if (rawIdentifier === 'this') {
      return 'scope';
    } else if (this.isReservedIdentifier(rawIdentifier)) {
      return rawIdentifier;
    } else {
      const nextId = this.getNextDistinctVariableName();

      const inLocals = this.stage === CompileStage.Inputs
        ? 'false'
        : this.getHasOwnProperty('locals', rawIdentifier)

      this.if_(inLocals, this.assign(nextId, this.lookupPropertyOnObject('locals', rawIdentifier)));

      if (safeTraverse) {
        this.if_(
          this.not(inLocals)
          + '&& scope && '
          + this.not(this.getHasOwnProperty('scope', rawIdentifier)),
          this.assign(this.lookupPropertyOnObject('scope', rawIdentifier), '{}'));
      }

      this.if_(`${this.not(inLocals)} && scope`, this.assign(nextId, this.lookupPropertyOnObject('scope', rawIdentifier)));

      if (context) {
        context.context = `${inLocals} ? locals : scope`;
        context.name = rawIdentifier;
        context.isComputed = false;
      }

      this.addObjectSafetyValidation(nextId);

      return nextId;
    }
  }

  private getMemberExpression(ast: any, context?: any, safeTraverse?: boolean): string {
    const nextVariableName = this.getNextDistinctVariableName();
    const left = this.recurse(ast.object, context, safeTraverse);

    if (context) {
      context.context = left;
    }

    if (ast.isComputed) {
      const right = this.recurse(ast.property);

      this.addAttributeSafetyValidation(right);

      if (safeTraverse) {
        this.if_(
          this.not(this.lookupComputedPropertyOnObject(left, right)),
          this.assign(this.lookupComputedPropertyOnObject(left, right), '{}'));
      }

      this.if_(
        left,
        this.assign(
          nextVariableName,
          `validateObjectSafety(${this.lookupComputedPropertyOnObject(left, right)})`));

      if (context) {
        context.name = right;
        context.isComputed = true;
      }
    } else {
      this.validateAttributeSafety(ast.property.name);

      if (safeTraverse) {
        this.if_(
          this.not(this.lookupPropertyOnObject(left, ast.property.name)),
          this.assign(this.lookupPropertyOnObject(left, ast.property.name), '{}'));
      }

      this.if_(
        left,
        this.assign(
          nextVariableName,
          `validateObjectSafety(${this.lookupPropertyOnObject(left, ast.property.name)})`));

      if (context) {
        context.name = ast.property.name;
        context.isComputed = false
      }
    }

    return nextVariableName;
  }

  private getMultiplicativeOperation(ast: any): string {
    return `(${this.recurse(ast.left)}) ${ast.operator} (${this.recurse(ast.right)})`;
  }

  private getAdditiveOperation(ast: any): string {
    return `(${this.addIfDefined(this.recurse(ast.left), 0)})`
      + ast.operator
      + `(${this.addIfDefined(this.recurse(ast.right), 0)})`;
  }

  private getConditionalExpression(ast: any): string {
    const testId = this.getNextDistinctVariableName();

    this.state[this.state.computingNode].body.push(this.assign(testId, this.recurse(ast.test)));

    const resultId = this.getNextDistinctVariableName();

    this.if_(testId, this.assign(resultId, this.recurse(ast.consequent)));

    this.if_(this.not(testId), this.assign(resultId, this.recurse(ast.alternate)));

    return resultId;
  }

  private getCallExpression(ast: any): string {
    if (ast.filter) {
      const callee = this.filter(ast.callee.name);

      const args = ast.arguments.map((arg: any) => this.recurse(arg));

      return `${callee}(${args})`;
    }

    const callContext: any = {};
    let callee = this.recurse(ast.callee, callContext);

    const args = ast.arguments.map((arg: any) => {
      return `validateObjectSafety(${this.recurse(arg)})`;
    });

    if (callContext.name) {
      this.addObjectSafetyValidation(callContext.context);

      if (callContext.isComputed) {
        callee = this.lookupComputedPropertyOnObject(callContext.context, callContext.name);
      } else {
        callee = this.lookupPropertyOnObject(callContext.context, callContext.name);
      }
    }

    this.addFunctionSafetyValidation(callee);

    return `${callee} && validateObjectSafety(${callee}(${args.join(',')}))`;
  }

  private lookupPropertyOnObjectSafe(obj: string, property: string): string {
    const scopeAttributeId = this.getNextDistinctVariableName();

    this.if_(obj, this.assign(scopeAttributeId, `${obj}.${property}`));

    return scopeAttributeId;
  }

  private lookupPropertyOnObject(obj: string, property: string): string {
    return `${obj}.${property}`;
  }

  private lookupComputedPropertyOnObject(obj: string, property: string): string {
    return `(${obj})[${property}]`;
  }

  private isReservedIdentifier(identifier: string) {
    return ['true', 'false', 'null'].indexOf(identifier) > -1;
  }

  private if_(test: string, consequence: string): void {
    this.state[this.state.computingNode].body.push(`if(${test}) { ${consequence} } `);
  }

  private assign(id: string, value: string): string {
    return `${id} = ${value};`;
  }

  private not(obj: string) {
    return `!(${obj})`;
  }

  private getHasOwnProperty(obj: string, property: string): string {
    return `${obj} && (${this.escapeIfNecessary(property)} in ${obj})`;
  }

  private getNextDistinctVariableName(skipDeclaration?: boolean): string {
    const nextId = `v${this.nextId++}`;

    if (!skipDeclaration) {
      this.state[this.state.computingNode].vars.push(nextId);
    }

    return nextId;
  }

  private validateAttributeSafety(attr: string): string {
    const disallowedAttributes = [
      'constructor',
      '__proto__',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ];

    if (disallowedAttributes.indexOf(attr) > -1) {
      throw 'Attempted to access a disallowed field in Angular expression.';
    }

    return attr;
  }

  private filter(filterName: string): string {
    if (!this.state.filters.hasOwnProperty(filterName)) {
      this.state.filters[filterName] = this.getNextDistinctVariableName(true);
    }

    return this.state.filters[filterName];
  }

  private validateObjectSafety(obj: any): any {
    if (obj) {
      if (obj.document && obj.location && obj.alert && obj.setInterval) {
        throw 'Referencing window in Angular expressions is disallowed.';
      } else if (obj.children
        && (obj.nodeName || (obj.prop || obj.attr && obj.find))) {
        throw 'Referencing DOM nodes in Angular expressions is diallowed.';
      } else if (obj === obj.constructor) {
        throw 'Referencing Function in Angular expressions is disallowed.';
      } else if (obj.getOwnPropertyNames || obj.getOwnPropertyDescriptor) {
        throw 'Referencing Object in Angular expressions is disallowed';
      }
    }

    return obj;
  }

  private validateFunctionSafety(obj: any) {
    const CALL = Function.prototype.call;
    const APPLY = Function.prototype.apply;
    const BIND = Function.prototype.bind;

    if (obj) {
      if (obj.constructor === obj) {
        throw 'Referencing Function in Angular expressions is disallowed.';
      } else if (obj === CALL || obj === APPLY || obj === BIND) {
        throw 'Referencing call, apply, and bind is disallowed in Angular expressions.';
      }
    }

    return obj;
  }

  private ifDefined(value: any, defaultValue: any): any {
    return typeof value === 'undefined' ? defaultValue : value;
  }

  private addAttributeSafetyValidation(expr: string): void {
    this.state[this.state.computingNode].body.push(`validateAttributeSafety(${expr});`);
  }

  private addObjectSafetyValidation(expr: string): void {
    this.state[this.state.computingNode].body.push(`validateObjectSafety(${expr});`);
  }

  private addFunctionSafetyValidation(expr: string): void {
    this.state[this.state.computingNode].body.push(`validateFunctionSafety(${expr});`);
  }

  private addIfDefined(value: any, defaultValue: any): string {
    return `ifDefined(${value}, ${this.escapeIfNecessary(defaultValue)})`;
  }

  private filterPrefix(): string {
    if (_.isEmpty(this.state.filters)) {
      return '';
    } else {
      const filterDeclarations = _.map(this.state.filters, (filterId, filterName) => {
        return `${filterId} = filterService.filter(${this.escapeIfNecessary(filterName)})`;
      });

      return `var ${filterDeclarations.join(',')};`;
    }
  }

  private isLiteral(ast: any): boolean {
    let numberOfStatements = ast.body.length;

    if (numberOfStatements === 0) {
      return true;
    }

    if (numberOfStatements > 1) {
      return false;
    }

    let statement = ast.body[0];
    let statementType = statement.type;

    return statementType === ASTComponents.Literal
        || statementType === ASTComponents.ArrayExpression
        || statementType === ASTComponents.ObjectExpression
        || (statementType === ASTComponents.Identifier && this.isReservedIdentifier(statement.name));
  }

  private isConstant(ast: any): boolean {
    switch (ast.type) {
      case ASTComponents.Program:
        return ast.body.every((expression: any) => {
          return this.isConstant(expression);
        });
      case ASTComponents.ArrayExpression:
        return ast.elements.every((element: any) => {
          return this.isConstant(element);
        });
      case ASTComponents.ObjectExpression:
        return ast.properties.every((property: any) => {
          return this.isConstant(property.value);
        });
      case ASTComponents.Literal:
        return true;
      case ASTComponents.Identifier:
        return this.isReservedIdentifier(ast.name);
      case ASTComponents.MemberExpression:
        return ast.isComputed
          ? this.isConstant(ast.object) && this.isConstant(ast.property)
          : this.isConstant(ast.object);
      case ASTComponents.CallExpression:
        return this.isCallStateless(ast)
          && ast.arguments.every((argument: any) => this.isConstant(argument));
      case ASTComponents.AssignmentExpression:
        return this.isConstant(ast.left) && this.isConstant(ast.right);
      case ASTComponents.UnaryExpression:
        return this.isConstant(ast.argument);
      case ASTComponents.BinaryExpression:
      case ASTComponents.LogicalExpression:
        return this.isConstant(ast.left) && this.isConstant(ast.right);
      case ASTComponents.ConditionalExpression:
        return this.isConstant(ast.test)
          && this.isConstant(ast.consequent)
          && this.isConstant(ast.alternate);
      default:
        return false;
    }
  }

  private findTopLevelWatchInputs(ast: any): any[] {
    if (ast.length !== 1) {
      return [];
    }

    const candidateWatches = this.findInputs(ast[0])

    if (candidateWatches.length !== 1 || candidateWatches[0] !== ast[0]) {
      return candidateWatches;
    } else {
      return [];
    }
  }

  private findInputs(ast: any): any[] {
    switch (ast.type) {
      case ASTComponents.Program:
        let programInputs: any[] = [];

        ast.body.forEach((expression: any) => {
          programInputs = programInputs.concat(this.findInputs(expression));
        });

        return programInputs;
      case ASTComponents.ArrayExpression:
        let arrayInputs: any[] = [];

        ast.elements
          .filter((element: any) => !this.isConstant(element))
          .forEach((element: any) => arrayInputs = arrayInputs.concat(this.findInputs(element)));

        return arrayInputs;
      case ASTComponents.ObjectExpression:
        let objectInputs: any[] = [];

        _.forEach(ast.properties, (property) => {
          if (!this.isConstant(property.value)) {
            objectInputs = objectInputs.concat(this.findInputs(property.value));
          }
        });

        return objectInputs;
      case ASTComponents.MemberExpression:
        return [ast];
      case ASTComponents.CallExpression:
        let callInputs: any[] = [];

        ast.arguments
          .filter((arg: any) => !this.isConstant(arg))
          .forEach((arg: any) => callInputs = callInputs.concat(this.findInputs(arg)));

        return this.isCallStateless(ast) ? callInputs : [ast];
      case ASTComponents.AssignmentExpression:
        let assignmentInputs: any[] = [];

        assignmentInputs = assignmentInputs.concat(this.findInputs(ast.left));
        assignmentInputs = assignmentInputs.concat(this.findInputs(ast.right));

        return assignmentInputs;
      case ASTComponents.UnaryExpression:
        return this.findInputs(ast.argument);
      case ASTComponents.BinaryExpression:
      case ASTComponents.LogicalExpression:
        return this.findInputs(ast.left).concat(this.findInputs(ast.right));
      case ASTComponents.ConditionalExpression:
        return [ast];
      case ASTComponents.Identifier:
        return [ast];
      default:
        return <any[]>[];
    }
  }

  private isCallStateless(ast: any) {
    if (ast.type !== ASTComponents.CallExpression) {
      throw 'Not a call expression.';
    }

    return ast.filter
      && !FilterService.getInstance().filter(ast.callee.name).$stateful;
  }

  private getWatchFunctions(): string {
    const result = this.state.inputs.map((inputName: string) => {
      let watchFunction = `var ${inputName} = function(scope) {`
        + (this.state[inputName].vars.length
          ? `var ${this.state[inputName].vars.join(',')};`
          : '')
        + this.state[inputName].body.join('')
        + '};'

        return watchFunction
    });

    if (result.length) {
      result.push(`fn.inputs = [${this.state.inputs.join(',')}];`);
    }

    return result.join('');
  }
}

class Parser {
  private lexer: Lexer;
  private ast: AST;
  private astCompiler: ASTCompiler

  constructor(lexer: Lexer) {
    this.lexer = lexer;
    this.ast = new AST(lexer);
    this.astCompiler = new ASTCompiler(this.ast);
  }

  public parse(text: string): IParseResult {
    return this.astCompiler.compile(text);
  }
}
