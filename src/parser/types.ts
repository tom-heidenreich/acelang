import { IdentifierToken, SymbolToken, Token } from "../lexer/tokens";
import { FloatType, Int32Type, Int64Type, OptionalType, Type } from "../types";

const builtIn: Record<string, Type | undefined> = {
    'int': new Int32Type(),
    'i32': new Int32Type(),
    'long': new Int64Type(),
    'i64': new Int64Type(),
    'float': new FloatType(),
}

export default function parseType(tokens: Token[]): Type {
    if(tokens.length === 0) throw new SyntaxError('Expected type name');

    const first = tokens[0];
    if(first instanceof IdentifierToken) {
        if(tokens.length === 1) {
            const type = builtIn[first.identifier];
            if(type === undefined) throw new SyntaxError(`Unknown type ${first.identifier}`);
            return type;
        }
        const second = tokens[1];
        if(second instanceof SymbolToken && second.symbol === '?') {
            const type = builtIn[first.identifier];
            if(type === undefined) throw new SyntaxError(`Unknown type ${first.identifier}`);
            return new OptionalType(type);
        }
    }

    console.log(tokens);

    throw new Error('Not implemented')
}