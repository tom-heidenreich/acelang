import { NewLineToken, Token } from "./tokens";

class TokenCollector {
    private _index: number = 0;
    private readonly tokens: Token[] = [];

    public set token(token: Token) {
        this.tokens[this._index] = token;
    }

    public next() {
        if(this.tokens.length === 0) return;
        this._index++;
    }

    public collect() {
        return this.tokens;
    }

    public isEmpty() {
        return this.tokens.length === 0;
    }
}

class ReadonlySharedFlags<T extends string[]> {

    protected readonly flags: Record<T[number], boolean> = {} as any;

    public get(key: T[number]): boolean {
        return this.flags[key];
    }
}

export class SharedFlags<T extends string[]> extends ReadonlySharedFlags<T> {

    public set(key: T[number], value: boolean): SharedFlags<T> {
        this.flags[key] = value;
        return this;
    }

    public enable(key: T[number]): SharedFlags<T> {
        return this.set(key, true);
    }
}

export abstract class LexerState<T extends string[]> {

    constructor(protected readonly flags: SharedFlags<T>) {}
    // constructor(protected readonly flags: SharedFlags<T> = new SharedFlags<T>()) {}

    public abstract get output(): Token | undefined
    public abstract getNextState(c: string): LexerState<T> | SyntaxError;

    public get readonlyFlags(): ReadonlySharedFlags<T> {
        return this.flags;
    }
}

export class Lexer {

    private readonly tokenCollector = new TokenCollector();

    constructor(private readonly initialState: LexerState<any>) {}

    private state: LexerState<any> = this.initialState;

    public tokenize(input: string): Token[][] {
        for(let i = 0; i < input.length; i++) {
            const c = input.charAt(i);

            const newState = this.state.getNextState(c);
            if(newState instanceof SyntaxError) {
                console.error(`Error occured during state change from ${this.state.constructor.name} at character ${i}`);
                throw newState;
            }
            
            const output = newState.output;
            if(output) {
                // override token if no state change
                if(this.state !== newState) this.tokenCollector.next();

                // possible char edge case
                if(output instanceof NewLineToken && output.prevToken !== undefined) {
                    this.tokenCollector.token = output.prevToken;
                    this.tokenCollector.next();
                }
                
                this.tokenCollector.token = output;
            }
            this.state = newState;
        }
        
        const tokens = this.tokenCollector.collect();
        // split the token list at NewLineTokens
        const splitTokens: Token[][] = [[]];
        for(const token of tokens) {
            if(token instanceof NewLineToken) splitTokens.push([]);
            else splitTokens[splitTokens.length - 1].push(token);
        }

        return splitTokens.filter(tokens => tokens.length !== 0);
    }
}