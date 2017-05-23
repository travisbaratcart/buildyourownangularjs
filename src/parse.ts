interface IToken {
  text: string;
  value: any;
}

enum ASTComponents {
  NotSpecified,
  Program,
  Literal
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

    for (this.currentCharIndex = 0; this.currentCharIndex < this.text.length; this.currentCharIndex++) {
      let currentChar = this.text[this.currentCharIndex];
      let nextChar = this.peekNextChar();

      if (this.isBeginningOfNumber(currentChar, nextChar)) {
        this.readNumber();
      } else if (this.isBeginningOfString(currentChar)) {
        this.readString();
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

  private addToken(text: string, value: any): void {
    let newToken: IToken = { text, value };

    this.tokens.push(newToken);
  }

  private isBeginningOfNumber(char: string, nextChar: string): boolean {
    return this.isCharNumber(char) || (char ===  '.' &&  this.isCharNumber(nextChar));
  }

  private isBeginningOfString(char: string): boolean {
    return char === '\'' || char === '"';
  }

  private isCharNumber(char: string): boolean {
    return '0' <= char && char <= '9';
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
      body: this.constant()
    };
  }

  private constant() {
    return {
      type: ASTComponents.Literal,
      value: this.tokens[0].value
    };
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
      default:
        throw 'Invalid syntax component.'
    }
  }

  private escapeIfNecessary(value: any): any {
    if (typeof value === 'string') {
      return `'${value.replace(this.stringEscapeRegex, this.stringEscapeFunc)}'`;
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
