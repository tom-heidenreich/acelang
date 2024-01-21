export class Token {

}

export const KEYWORDS = ['const', 'var', 'type', 'func', 'return'] as const

export const SYMBOLS = ['+', '-', '*', '/', ':', ';', '=', '<', '>', '!', '&', '|', ',', '.'] as const;
export const OPERATORS = ['+', '-', '*', '/', '=', '<', '>', '==', '!=', '<=', '>=', '&&', '||', '=>'] as const;

export const STRING_QUOTES = ['\'', '"'] as const;
export const BRACKETS = [['(', ')'], ['[', ']'], ['{', '}']] as const;

export type Keyword = typeof KEYWORDS[number];
export type Symbol = typeof SYMBOLS[number];
export type Operator = typeof OPERATORS[number];
export type StringQuote = typeof STRING_QUOTES[number];
export type Bracket = typeof BRACKETS[number];

export function isKeyword(s: string): s is Keyword {
    return KEYWORDS.includes(s as Keyword);
}

export function isSymbol(s: string): s is Symbol {
    return SYMBOLS.includes(s as Symbol);
}

export function isOperator(s: string): s is Operator {
    return OPERATORS.includes(s as Operator);
}

export function isStringQuote(s: string): s is StringQuote {
    return STRING_QUOTES.includes(s as StringQuote);
}

export function isOpeningBracket(s: string): s is Bracket[0] {
    return BRACKETS.some(b => b[0] === s);
}
export function getClosingBracket(s: Bracket[0]): Bracket[1] {
    return BRACKETS.find(b => b[0] === s)![1];
}

export function isBoolean(s: string): s is 'true' | 'false' {
    return s === 'true' || s === 'false';
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