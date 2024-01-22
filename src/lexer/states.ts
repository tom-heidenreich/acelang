import { Lexer, LexerState, SharedFlags } from "."
import {
    Bracket,
    StringQuote,
    Symbol,
    getClosingBracket,
    isBoolean,
    isKeyword,
    isOpeningBracket,
    isOperator, 
    isStringQuote, 
    isSymbol 
} from "../constants";
import {
    BooleanToken,
    BracketToken, 
    CharToken, 
    CurlyBracketToken, 
    FloatToken, 
    IdentifierToken, 
    IntegerToken, 
    KeywordToken, 
    NewLineToken, 
    OperatorToken, 
    ParenthesisToken, 
    StringToken, 
    SymbolToken, 
    Token,  
} from "./tokens";

function isNewLine(c: string, newLineWithComma: boolean) {
    return c === '\n' || c === '\r'  || (newLineWithComma && c === ',');
}

function isWhitespace(c: string) {
    return c === ' ' || c === '\t';
}

function isSoftTokenEnd(c: string, newLineWithComma: boolean) {
    return isWhitespace(c) || isNewLine(c, newLineWithComma);
}

function isTokenEnd(c: string, newLineWithComma: boolean) {
    return isSoftTokenEnd(c, newLineWithComma) || c === ';';
}

type SharedFlagKeys = ['newLineWithComma'];

export class InitialState extends LexerState<SharedFlagKeys> {

    constructor(flags: SharedFlags<SharedFlagKeys>) {
        super(flags);
    }

    public get output(): Token | undefined {
        return undefined;
    }

    public getNextState(c: string): LexerState<SharedFlagKeys> | SyntaxError {
        if(/[a-bd-zA-Z]/.test(c)) return new AlphabeticIdentifierState(this.flags, c);
        if(/[c]/.test(c)) return new PossibleCharState(this.flags);
        if(/[0-9]/.test(c)) return new IntegerState(this.flags, c);
        if(c === '#') return new CommentState(this.flags);
        if(isSymbol(c)) return new SymbolState(this.flags, c);
        if(isStringQuote(c)) return new StringState(this.flags, c);
        if(isOpeningBracket(c)) return new BlockState(this.flags, c);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Unexpected character ${c}`);
    }
}

class InitialStateAfterTokenEnd extends InitialState {

    constructor(flags: SharedFlags<SharedFlagKeys>, private readonly isNewLine: boolean) {
        super(flags);
    }

    public get output() {
        if(this.isNewLine) return new NewLineToken();
    }
}

class CommentState extends LexerState<SharedFlagKeys> {
    
    public get output() {
        return undefined;
    }

    public getNextState(c: string) {
        if(isNewLine(c, this.flags.get('newLineWithComma'))) return new InitialState(this.flags);
        return this;
    }
}

class AlphabeticIdentifierState extends LexerState<SharedFlagKeys> {

    private identifier: string;

    constructor(flags: SharedFlags<SharedFlagKeys>, c: string) {
        super(flags);
        this.identifier = c;
    }

    public get output() {
        if(isKeyword(this.identifier)) return new KeywordToken(this.identifier);
        if(isBoolean(this.identifier)) return new BooleanToken(this.identifier);
        return new IdentifierToken(this.identifier);
    }

    public getNextState(c: string) {
        if(/[a-zA-Z]/.test(c)) {
            this.identifier += c;
            return this;
        }
        if(/[_0-9]/.test(c)) return new IdentifierState(this.flags, c);
        if(isSymbol(c)) return new SymbolState(this.flags, c);
        if(isOpeningBracket(c)) return new BlockState(this.flags, c);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Unexpected character ${c}`);
    }
}

class IdentifierState extends LexerState<SharedFlagKeys> {

    private identifier: string;

    constructor(flags: SharedFlags<SharedFlagKeys>, c: string) {
        super(flags);
        this.identifier = c;
    }

    public get output() {
        return new IdentifierToken(this.identifier);
    }

    public getNextState(c: string) {
        if(/[a-zA-Z0-9_]/.test(c)) {
            this.identifier += c;
            return this;
        }
        if(isSymbol(c)) return new SymbolState(this.flags, c);
        if(isOpeningBracket(c)) return new BlockState(this.flags, c);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Expected [a-zA-Z0-9_], got ${c}`);
    }
}

class SymbolState extends LexerState<SharedFlagKeys> {

    private readonly symbols: Symbol[];

    constructor(flags: SharedFlags<SharedFlagKeys>, c: Symbol) {
        super(flags);
        this.symbols = [c];
    }

    public get output() {
        const joined = this.symbols.join('');
        if(isOperator(joined)) return new OperatorToken(joined);
        if(this.symbols.length === 1) return new SymbolToken(this.symbols[0]);
        // error should never happen
        throw new SyntaxError(`Unexpected symbol ${joined}`);
    }

    public getNextState(c: string) {
        if(isSymbol(c)) {
            if(!isOperator(this.symbols.join('') + c)) return new SyntaxError(`Unexpected symbol ${this.symbols.join('') + c}`);
            this.symbols.push(c);
            return this;
        }
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Expected symbol, got ${c}`);
    }
}

class IntegerState extends LexerState<SharedFlagKeys> {

    private integer: string;

    constructor(flags: SharedFlags<SharedFlagKeys>, c: string) {
        super(flags);
        this.integer = c;
    }

    public get output() {
        const integer = parseInt(this.integer);
        if(isNaN(integer)) return new SyntaxError(`Invalid integer ${this.integer}`);
        return new IntegerToken(integer);
    }

    public getNextState(c: string) {
        if(/[0-9]/.test(c)) {
            this.integer += c;
            return this;
        }
        if(c === '.') return new FloatState(this.flags, this.integer);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Expected [0-9.], got ${c}`);
    }
}

class FloatState extends LexerState<SharedFlagKeys> {

    private fraction: string = '';

    constructor(flags: SharedFlags<SharedFlagKeys>, private readonly integer: string) {
        super(flags);
    }

    public get output() {
        const float = parseFloat(`${this.integer}.${this.fraction}`);
        if(isNaN(float)) return new SyntaxError(`Invalid float ${this.integer}`);
        if(this.fraction.length === 0) return new IntegerToken(float);
        return new FloatToken(float);
    }

    public getNextState(c: string) {
        if(/[0-9]/.test(c)) {
            this.fraction += c;
            return this;
        }
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterTokenEnd(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Expected [0-9], got ${c}`);
    }
}

class PossibleCharState extends LexerState<SharedFlagKeys> {

    public get output() {
        return undefined
    }

    public getNextState(c: string) {
        if(c === '\'') return new CharState(this.flags);
        if(/[a-zA-Z]/.test(c)) return new AlphabeticIdentifierState(this.flags, `c${c}`);
        if(/[_0-9]/.test(c)) return new IdentifierState(this.flags, `c${c}`);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new InitialStateAfterPossibleCharEdgeCase(this.flags, isNewLine(c, this.flags.get('newLineWithComma')));
        return new SyntaxError(`Unexpected character ${c}`);
    }
}

// initial state after an identifier 'c'
class InitialStateAfterPossibleCharEdgeCase extends InitialState {

    constructor(flags: SharedFlags<SharedFlagKeys>, private readonly isNewLine: boolean) {
        super(flags);
    }

    public get output() {
        if(this.isNewLine) return new NewLineToken(new IdentifierToken('c'));
        return new IdentifierToken('c');
    }
}

class CharState extends LexerState<SharedFlagKeys> {
    
    private char: string = '';

    public get output() {
        return new CharToken(this.char);
    }

    public getNextState(c: string) {
        if(c === '\'') return new InitialState(this.flags);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new SyntaxError(`Unexpected end of char`);
        if(/[a-zA-Z0-9]/.test(c)) {
            if(this.char.length > 0) return new SyntaxError(`Char can only contain one character`);
            this.char = c;
            return this;
        }
        return new SyntaxError(`Unexpected character ${c}`);
    }
}

class StringState extends LexerState<SharedFlagKeys> {

    private string: string = '';

    constructor(flags: SharedFlags<SharedFlagKeys>, private readonly quote: StringQuote) {
        super(flags);
    }

    public get output() {
        return new StringToken(this.string);
    }

    public getNextState(c: string) {
        if(c === this.quote) return new InitialState(this.flags);
        if(isTokenEnd(c, this.flags.get('newLineWithComma'))) return new SyntaxError(`Unexpected end of string`);
        this.string += c;
        return this;
    }
}

class BlockState extends LexerState<SharedFlagKeys> {

    private closingBracket: Bracket[1];
    private openBrackets: number = 1;

    private content: string = '';

    constructor(flags: SharedFlags<SharedFlagKeys>, private readonly openingBracket: Bracket[0]) {
        super(flags);
        this.closingBracket = getClosingBracket(openingBracket);
    }

    public get output() {
        const lexer = new Lexer(new InitialState(this.flags.enable('newLineWithComma')));
        const tokens = lexer.tokenize(this.content);
        if(this.openingBracket === '(') return new ParenthesisToken(tokens);
        if(this.openingBracket === '[') return new BracketToken(tokens);
        if(this.openingBracket === '{') return new CurlyBracketToken(tokens);
        return new SyntaxError(`Unexpected opening bracket ${this.openingBracket}`);
    }

    public getNextState(c: string) {
        if(c === this.openingBracket) this.openBrackets++;
        if(c === this.closingBracket) {
            if(--this.openBrackets === 0) return new InitialState(this.flags);
        }
        this.content += c;
        return this;
    }
}

export const INITIAL_STATE = new InitialState(new SharedFlags<SharedFlagKeys>());