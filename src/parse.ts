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

      let isBeginningOfNumber = this.isCharNumber(currentChar)
        || (this.text[this.currentCharIndex] === '.' &&  this.isCharNumber(this.peekNextChar()))

      if (isBeginningOfNumber) {
        this.readNumber();
      } else {
        throw `Unexpected next character: ${this.text[this.currentCharIndex]}`;
      }
    }

    return this.tokens;
  }

  private readNumber(): void {
    let numberText = '';
    while (this.currentCharIndex < this.text.length) {
      let currentChar = this.text[this.currentCharIndex];

      if (this.isCharNumber(currentChar) || currentChar === '.') {
        numberText += currentChar;
      } else {
        break;
      }

      this.currentCharIndex++;
    }

    this.addToken(numberText, Number(numberText));
  }

  private addToken(text: string, value: any) {
    let newToken: IToken = { text, value };

    this.tokens.push(newToken);
  }

  private isCharNumber(char: string): boolean {
    return '0' <= char && char <= '9';
  }

  private peekNextChar(): string {
    return this.currentCharIndex < this.currentCharIndex - 1
      ? this.text.charAt(this.currentCharIndex + 1)
      : null;
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
        return ast.value;
      default:
        throw 'Invalid syntax component.'
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
