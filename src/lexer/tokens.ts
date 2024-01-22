import { Keyword, Operator, Symbol } from "../constants";

export class Token {

}

export class KeywordToken extends Token {
    constructor(public readonly keyword: Keyword) {
        super();
    }
}

export class IdentifierToken extends Token {
    constructor(public readonly identifier: string) {
        super();
    }
}

export abstract class TextValueToken extends Token {}

export class StringToken extends TextValueToken {
    constructor(public readonly string: string) {
        super();
    }
}

export class CharToken extends TextValueToken {
    constructor(public readonly char: string) {
        super();
    }
}

export abstract class NumberToken extends Token {}
export class IntegerToken extends NumberToken {
    constructor(public readonly integer: number) {
        super();
    }
}
export class FloatToken extends NumberToken {
    constructor(public readonly float: number) {
        super();
    }
}

export class BooleanToken extends Token {
    constructor(public readonly boolean: 'true' | 'false') {
        super();
    }
}

export class SymbolToken extends Token {
    constructor(public readonly symbol: Symbol) {
        super();
    }
}

export class OperatorToken extends Token {
    constructor(public readonly operator: Operator) {
        super();
    }
}

export abstract class BlockToken extends Token {
    constructor(public readonly content: Token[][]) {
        super();
    }
}

export class ParenthesisToken extends BlockToken {}
export class BracketToken extends BlockToken {}
export class CurlyBracketToken extends BlockToken {}

export class NewLineToken extends Token {
    constructor(public readonly prevToken: Token | undefined = undefined) {
        super();
    }
}