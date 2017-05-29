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
  AssignmentExpression
};

export function parse(expression: string): Function {
  let lexer = new Lexer();
  let parser = new Parser(lexer);

  return parser.parse(expression);
}

class Lexer {
  private text: string;
  private currentCharIndex: number;
  private tokens: IToken[] = [];

  public lex(text: string): IToken[] {
    this.text = text;

    this.currentCharIndex = 0;

    while (this.currentCharIndex < this.text.length) {
      let currentChar = this.text[this.currentCharIndex];
      let nextChar = this.peekNextChar();

      if (this.isBeginningOfNumber(currentChar, nextChar)) {
        this.readNumber();
      } else if (this.isBeginningOfString(currentChar)) {
        this.readString();
      } else if (this.is(currentChar, '[],{}:.()=')) {
        this.addToken(currentChar);
        this.currentCharIndex++;
      } else if (this.isIdentifierComponent(currentChar)) {
        this.readIdentifier();
      } else if (this.isCharWhitespace(currentChar)) {
        this.currentCharIndex++
      } else {
        throw `Unexpected next character: ${this.text[this.currentCharIndex]}`;
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
        const nextChar = this.peekNextChar();
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

    let result = '';

    this.currentCharIndex++ // move past opening quote

    while (this.currentCharIndex < this.text.length) {
      let currentChar = this.text[this.currentCharIndex];
      if (currentChar === '\\') {
        const nextChar = this.peekNextChar();

        const escapeChar = ESCAPES[nextChar];

        if (nextChar === 'u') {
          const hex = this.text.substring(this.currentCharIndex + 2, this.currentCharIndex + 6);

          if (!hex.match(/[\da-f]{4}/i)) {
            throw 'Invalid unicode escape';
          }

          this.currentCharIndex += 6;
          result += String.fromCharCode(parseInt(hex, 16));
        } else if (escapeChar) {
          result += escapeChar;
          this.currentCharIndex += 2;
        } else {
          result += this.peekNextChar();
          this.currentCharIndex += 2;
        }
      } else if (currentChar === openingQuote) {
        this.currentCharIndex++;
        this.addToken(result, result);
        return;
      } else {
        result += currentChar;
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

  private peekNextChar(): string {
    return this.currentCharIndex < this.text.length - 1
      ? this.text.charAt(this.currentCharIndex + 1)
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
    return {
      type: ASTComponents.Program,
      body: this.assignment()
    };
  }

  private primary(): any {
    let primary: any;

    if (this.expect('[')) {
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
    const left = this.primary();

    if (this.expect('=')) {
      const right = this.primary();
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
      vars: []
    };

    this.recurse(ast);

    const varsDeclaration = this.state.vars.length
      ? `var ${this.state.vars.join(',')};`
      : '';

    const functionBody = varsDeclaration + this.state.body.join('');

    const functionString = 'var fn = function(scope, locals){'
      + varsDeclaration
      + functionBody
      + '}; return fn;'

    return new Function(
      'validateAttributeSafety',
      'validateObjectSafety',
      functionString)(
        this.validateAttributeSafety,
        this.validateObjectSafety
      );
  }

  private recurse(ast: any, context?: any, safeTraverse?: boolean): any {
    switch (ast.type) {
      case ASTComponents.Program:
        this.state.body.push('return ', this.recurse(ast.body), ';');
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
        const callContext: any = {};
        let callee = this.recurse(ast.callee, callContext);

        const args = ast.arguments.map((arg: any) => {
          return `validateObjectSafety(${this.recurse(arg)})`;
        });

        if (callContext.name) {
          if (callContext.isComputed) {
            callee = this.lookupComputedPropertyOnObject(callContext.context, callContext.name);
          } else {
            callee = this.lookupPropertyOnObject(callContext.context, callContext.name);
          }
        }

        return `${callee} && ${callee}(${args.join(',')})`;
      case ASTComponents.AssignmentExpression:
        const leftContext: any = {};
        this.recurse(ast.left, leftContext, true);

        const leftSide = leftContext.isComputed
          ? this.lookupComputedPropertyOnObject(leftContext.context, leftContext.name)
          : this.lookupPropertyOnObject(leftContext.context, leftContext.name);

        return this.assign(leftSide, this.recurse(ast.right));

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

  private getNextDistinctVariableName(): string {
    const nextId = `v${this.nextId++}`;

    this.state.vars.push(nextId);

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

  private validateObjectSafety(obj: any): any {
    if (obj) {
      if (obj.document && obj.location && obj.alert && obj.setInterval) {
        throw 'Referencing window in Angular expressions is disallowed';
      }
    }

    return obj;
  }

  private addAttributeSafetyValidation(expr: string): void {
    this.state.body.push(`validateAttributeSafety(${expr});`);
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
