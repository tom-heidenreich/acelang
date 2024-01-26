import { Keyword, Operator, Symbol } from "../constants";

export abstract class Token {
    public abstract toString(): string;
}

export class KeywordToken extends Token {
    constructor(public readonly keyword: Keyword) {
        super();
    }

    public toString(): string {
        return this.keyword;
    }
}

export class IdentifierToken extends Token {
    constructor(public readonly identifier: string) {
        super();
    }

    public toString(): string {
        return this.identifier;
    }
}

export abstract class TextValueToken extends Token {}

export class StringToken extends TextValueToken {
    constructor(public readonly string: string) {
        super();
    }

    public toString(): string {
        return `"${this.string}"`;
    }
}

export class CharToken extends TextValueToken {
    constructor(public readonly char: string) {
        super();
    }

    public toString(): string {
        return `'${this.char}'`;
    }
}

export abstract class NumberToken extends Token {}
export class IntegerToken extends NumberToken {
    constructor(public readonly integer: number) {
        super();
    }

    public toString(): string {
        return this.integer.toString();
    }
}
export class FloatToken extends NumberToken {
    constructor(public readonly float: number) {
        super();
    }

    public toString(): string {
        return this.float.toString();
    }
}

export class BooleanToken extends Token {
    constructor(public readonly boolean: 'true' | 'false') {
        super();
    }

    public toString(): string {
        return this.boolean;
    }
}

export class SymbolToken extends Token {
    constructor(public readonly symbol: Symbol) {
        super();
    }

    public toString(): string {
        return this.symbol;
    }
}

export class OperatorToken extends Token {
    constructor(public readonly operator: Operator) {
        super();
    }

    public toString(): string {
        return this.operator;
    }
}

export abstract class BlockToken extends Token {
    constructor(public readonly content: Token[][]) {
        super();
    }

    public toString(): string {
        return `(${this.content.map(tokens => tokens.join('')).join('')})`;
    }
}

export class ParenthesisToken extends BlockToken {}
export class BracketToken extends BlockToken {}
export class CurlyBracketToken extends BlockToken {}

export class NewLineToken extends Token {
    constructor(public readonly prevToken: Token | undefined = undefined) {
        super();
    }

    public toString(): string {
        return '<newline>';
    }
}