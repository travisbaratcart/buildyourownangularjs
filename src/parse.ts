interface IToken {
  text: string;
  value?: any;
}

enum ASTComponents {
  NotSpecified,
  Program,
  Literal,
  ArrayExpression
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
      } else if (currentChar === '[' || currentChar === ']' || currentChar === ',') {
        this.addToken(currentChar);
        this.currentCharIndex++;
      } else if (this.isBeginningOfIdentifier(currentChar)) {
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

    this.addToken(numberText, Number(numberText));
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

      if (this.isBeginningOfIdentifier(currentChar) || this.isCharNumber(currentChar)) {
        result += currentChar;
      } else {
        break;
      }

      this.currentCharIndex++;
    }

    this.addToken(result, eval(result));
  }

  private addToken(text: string, value?: any): void {
    let newToken: IToken = { text, value };

    this.tokens.push(newToken);
  }

  private isBeginningOfNumber(char: string, nextChar: string): boolean {
    return this.isCharNumber(char) || (char ===  '.' &&  this.isCharNumber(nextChar));
  }

  private isBeginningOfString(char: string): boolean {
    return char === '\'' || char === '"';
  }

  private isBeginningOfIdentifier(char: string): boolean {
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

  private primary() {
    if (this.expect('[')) {
      return this.arrayDeclaration();
    } else {
      return this.constant();
    }
  }

  private constant() {
    return {
      type: ASTComponents.Literal,
      value: this.consume().value
    };
  }

  private arrayDeclaration() {
    const elements = [];

    const nextToken = this.peekNextToken();

    if (nextToken && nextToken.text !== ']') {
      do {
        elements.push(this.primary());
      } while (this.expect(','))
    }

    this.consume(']');

    return {
      type: ASTComponents.ArrayExpression,
      elements: elements
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

  constructor(
    private astBuilder: AST) {

  }

  public compile(text: string): Function {
    let ast = this.astBuilder.ast(text);

    this.state = {
      body: []
    };

    this.recurse(ast);

    return new Function(this.state.body.join(''));
  }

  private recurse(ast: any): any {
    switch (ast.type) {
      case ASTComponents.Program:
        this.state.body.push('return ', this.recurse(ast.body), ';');
        break;
      case ASTComponents.Literal:
        return this.escapeIfNecessary(ast.value);
      case ASTComponents.ArrayExpression:
        const elements = ast.elements.map(element => {
          return this.recurse(element);
        });
        return `[${elements.join(',')}]`;
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
