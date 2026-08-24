const TOKEN_PATTERN = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)|([()+\-*/^,]))/gy;

const FUNCTIONS: Record<string, (...values: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

class Parser {
  private index = 0;
  private readonly tokens: Array<{ type: "number" | "name" | "operator"; value: string }>;

  constructor(expression: string) {
    this.tokens = [];
    TOKEN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    let parsedThrough = 0;
    while ((match = TOKEN_PATTERN.exec(expression))) {
      parsedThrough = TOKEN_PATTERN.lastIndex;
      if (match[1]) this.tokens.push({ type: "number", value: match[1] });
      else if (match[2]) this.tokens.push({ type: "name", value: match[2] });
      else this.tokens.push({ type: "operator", value: match[3] });
    }
    if (expression.slice(parsedThrough).trim() !== "") {
      throw new Error("Expression contains unsupported syntax");
    }
  }

  parse(): number {
    const value = this.parseAdditive();
    if (this.index !== this.tokens.length) throw new Error("Unexpected token in expression");
    if (!Number.isFinite(value)) throw new Error("Expression result is not finite");
    return value;
  }

  private peek(value?: string) {
    const token = this.tokens[this.index];
    return token && (!value || token.value === value) ? token : undefined;
  }

  private consume(value: string) {
    if (!this.peek(value)) throw new Error(`Expected '${value}'`);
    this.index += 1;
  }

  private parseAdditive(): number {
    let result = this.parseMultiplicative();
    while (this.peek("+") || this.peek("-")) {
      const operator = this.tokens[this.index++].value;
      const right = this.parseMultiplicative();
      result = operator === "+" ? result + right : result - right;
    }
    return result;
  }

  private parseMultiplicative(): number {
    let result = this.parsePower();
    while (this.peek("*") || this.peek("/")) {
      const operator = this.tokens[this.index++].value;
      const right = this.parsePower();
      if (operator === "/" && right === 0) throw new Error("Division by zero");
      result = operator === "*" ? result * right : result / right;
    }
    return result;
  }

  private parsePower(): number {
    const left = this.parseUnary();
    if (this.peek("^")) {
      this.index += 1;
      return Math.pow(left, this.parsePower());
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek("+")) {
      this.index += 1;
      return this.parseUnary();
    }
    if (this.peek("-")) {
      this.index += 1;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.tokens[this.index];
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") {
      this.index += 1;
      return Number(token.value);
    }

    if (token.type === "operator" && token.value === "(") {
      this.index += 1;
      const value = this.parseAdditive();
      this.consume(")");
      return value;
    }

    if (token.type === "name") {
      this.index += 1;
      const normalizedName = token.value.startsWith("Math.") ? token.value.slice(5) : token.value;
      const constant = normalizedName === "PI" ? Math.PI : normalizedName === "E" ? Math.E : undefined;
      if (constant !== undefined) return constant;

      const fn = FUNCTIONS[normalizedName];
      if (!fn) throw new Error(`Unknown math function or constant: ${token.value}`);
      this.consume("(");
      const args: number[] = [];
      if (!this.peek(")")) {
        args.push(this.parseAdditive());
        while (this.peek(",")) {
          this.index += 1;
          args.push(this.parseAdditive());
        }
      }
      this.consume(")");
      const result = fn(...args);
      if (!Number.isFinite(result)) throw new Error("Math function returned a non-finite result");
      return result;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }
}

export function evaluateMathExpression(expression: string): number {
  if (expression.length > 500) throw new Error("Expression is too long");
  return new Parser(expression).parse();
}
