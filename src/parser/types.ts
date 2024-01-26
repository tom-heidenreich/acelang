import { IdentifierToken, Token } from "../lexer/tokens";
import { FloatType, Int32Type, Int64Type, Type } from "../types";

const builtIn: Record<string, Type | undefined> = {
    'int': new Int32Type(),
    'i32': new Int32Type(),
    'long': new Int64Type(),
    'i64': new Int64Type(),
    'float': new FloatType(),
}

export default function parseType(tokens: Token[]): Type {
    if(tokens.length === 0) throw new SyntaxError('Expected type name');
    if(tokens.length === 1) {
        const token = tokens[0];
        if(!(token instanceof IdentifierToken)) throw new SyntaxError('Expected type name');
        const type = builtIn[token.identifier];
        if(type === undefined) throw new SyntaxError(`Unknown type ${token.identifier}`);
        return type;
    }

    console.log(tokens);

    throw new Error('Not implemented')
}