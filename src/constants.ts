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