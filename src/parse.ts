import * as _ from 'lodash';
import { FilterService } from './filter';

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

export function parse(expression?: string | Function): Function {
  switch (typeof expression) {
    case 'string':
      let lexer = new Lexer();
      let parser = new Parser(lexer);

      return parser.parse((<string>expression));
    case 'function':
      return <Function>expression;
    default:
      return _.noop;
  }
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

  private nextId = 0;

  constructor(
    private astBuilder: AST) {

  }

  public compile(text: string): Function {
    let ast = this.astBuilder.ast(text);

    this.state = {
      body: [],
      vars: [],
      filters: {}
    };

    this.recurse(ast);

    const filterPrefix = this.filterPrefix();

    const varsDeclaration = this.state.vars.length
      ? `var ${this.state.vars.join(',')};`
      : '';

    const functionBody = varsDeclaration + this.state.body.join('');

    const functionString = filterPrefix
      + 'var fn = function(scope, locals){'
      + varsDeclaration
      + functionBody
      + '}; return fn;'

    return new Function(
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
  }

  private recurse(ast: any, context?: any, safeTraverse?: boolean): any {
    switch (ast.type) {
      case ASTComponents.Program:
        const lastStatement = ast.body.pop();

        ast.body.forEach((statement: any) => {
          this.state.body.push(this.recurse(statement) + ';');
        });

        this.state.body.push('return ', this.recurse(lastStatement), ';');
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
        this.state.body.push(this.assign(nextId, this.recurse(ast.left)));

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

      this.if_(this.getHasOwnProperty('locals', rawIdentifier), this.assign(nextId, this.lookupPropertyOnObject('locals', rawIdentifier)));

      if (safeTraverse) {
        this.if_(
          this.not(this.getHasOwnProperty('locals', rawIdentifier))
          + '&& scope && '
          + this.not(this.getHasOwnProperty('scope', rawIdentifier)),
          this.assign(this.lookupPropertyOnObject('scope', rawIdentifier), '{}'));
      }

      this.if_(`${this.not(this.getHasOwnProperty('locals', rawIdentifier))} && scope`, this.assign(nextId, this.lookupPropertyOnObject('scope', rawIdentifier)));

      if (context) {
        context.context = `${this.getHasOwnProperty('locals', rawIdentifier)} ? locals : scope`;
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

    this.state.body.push(this.assign(testId, this.recurse(ast.test)));

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
    this.state.body.push(`if(${test}) { ${consequence} } `);
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
      this.state.vars.push(nextId);
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
    this.state.body.push(`validateAttributeSafety(${expr});`);
  }

  private addObjectSafetyValidation(expr: string): void {
    this.state.body.push(`validateObjectSafety(${expr});`);
  }

  private addFunctionSafetyValidation(expr: string): void {
    this.state.body.push(`validateFunctionSafety(${expr});`);
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

  public parse(text: string): Function {
    return this.astCompiler.compile(text);
  }
}
