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
  Identifier
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
      } else if (this.is(currentChar, '[],{}:')) {
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
      body: this.primary()
    };
  }

  private primary(): any {
    const nextToken = this.peekNextToken();

    if (this.expect('[')) {
      return this.arrayDeclaration();
    } else if (this.expect('{')) {
      return this.object();
    } else if (nextToken.isIdentifier) {
      return this.identifier();
    } else {
      return this.constant();
    }
  }

  private constant() {
    const nextToken = this.peekNextToken();

    return {
      type: ASTComponents.Literal,
      value: nextToken.isIdentifier
        ? eval(this.consume().text)
        : this.consume().value
    };
  }

  private arrayDeclaration(): any {
    const elements = [];

    const startingToken = this.peekNextToken();

    if (startingToken && startingToken.text !== ']') {
      do {
        let nextToken = this.peekNextToken();

        if (nextToken && nextToken.text === ']') {
          break;
        }

        elements.push(this.primary());
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

    const firstToken = this.peekNextToken();

    if (firstToken.text !== '}') {
      do {
        const nextToken = this.peekNextToken();

        const property: any = {
          type: ASTComponents.ObjectProperty,
          key: nextToken.isIdentifier
            ? this.identifier()
            : this.constant()
        };

        this.consume(':');

        property.value = this.primary();

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

  private expect(char?: string): IToken {
    const nextToken = this.peekNextToken();

    if (nextToken && (nextToken.text === char || !char)) {
      return this.tokens.shift();
    }
  }

  private consume(char?: string): IToken {
    const token = this.expect(char);

    if (!token) {
      throw `Unexpected. Expecting: ${char}`;
    }

    return token;
  }

  private peekNextToken() {
    if (this.tokens.length > 0) {
      return this.tokens[0];
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

    return new Function('scope', functionBody);
  }

  private recurse(ast: any): any {
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
        return this.isReservedIdentifier(ast.name)
          ? ast.name
          : this.lookupOnScope('scope', ast.name);
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

  private lookupOnScope(scope: string, identifier: string): string {
    const scopeAttributeId = this.getNextScopeAttributeId();

    this.if_('scope', `${scopeAttributeId} = (${scope}).${identifier};`)

    return scopeAttributeId;
  }

  private isReservedIdentifier(identifier: string) {
    return ['true', 'false', 'null'].indexOf(identifier) > -1;
  }

  private if_(test: string, consequence: string): void {
    this.state.body.push(`if(${test}) { ${consequence} } `);
  }

  private getNextScopeAttributeId(): string {
    const nextId = `v${this.nextId++}`;

    this.state.vars.push(nextId);

    return nextId;
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
