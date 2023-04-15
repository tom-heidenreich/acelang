import { Context, StructType, Token, Type, Types } from "../types";
import line from "../util/LineStringify";
import Cursor, { WriteCursor } from "../util/cursor";

function parseStructType(context: Context, cursor: Cursor<Token[]>): StructType {

    const struct: Types = {}

    while(!cursor.done) {
        const lineCursor = new Cursor(cursor.next());

        const key = lineCursor.next();
        if(key.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${key.type} at ${line(key)}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at ${line(lineCursor.peek())}`);
        }
        lineCursor.next();

        const value = parseType(context, lineCursor);

        struct[key.value] = value;
    }

    return {
        type: 'struct',
        properties: struct,
    };
}

export function parseType(context: Context, cursor: Cursor<Token>): Type {

    let types: Type[] = [];
    const writeCursor = new WriteCursor<Token>([]);

    function push() {
        
        const cursor = new Cursor(writeCursor.asList());
        const name = cursor.next();

        // array type
        if(!cursor.done) {
            const next = cursor.next();
            if(next.type !== 'block' || next.value !== '[]') {
                throw new Error(`Expected block '[]', got ${next.type} ${next.value} at ${line(next)}`);
            }
            if(!next.block) {
                throw new Error(`Expected block, got ${next.type} at ${line(next)}`);
            }
            // get array size
            if(next.block.length !== 1) throw new Error(`Expected one token in block, got ${next.block.length} at ${line(next)}`);
            const sizeTokens = next.block[0];
            if(sizeTokens.length !== 1) throw new Error(`Expected one token in block, got ${sizeTokens.length} at ${line(next)}`);
            const sizeToken = sizeTokens[0];
            if(sizeToken.type !== 'datatype' && sizeToken.specificType !== 'int') {
                throw new Error(`Expected integer, got ${sizeToken.type} ${sizeToken.specificType} at ${line(sizeToken)}`);
            }
            const size = parseInt(sizeToken.value);

            if(name.type === 'identifier') {
                const type = context.build.types[name.value]
                if(!type) {
                    throw new Error(`Unknown datatype: ${name.value} at ${line(name)}`);
                }
                types.push({
                    type: 'array',
                    items: type,
                    size
                });
            }
            else if(name.type === 'block') {
                if(!name.block) {
                    throw new Error(`Expected block, got ${name.type} at ${line(name)}`);
                }
                types.push({
                    type: 'array',
                    items: parseType(context, new Cursor(name.block[0])),
                    size
                });
            }
            else {
                throw new Error(`Unknown type: ${name.type} at ${line(name)}`);
            }
        }
        else if(name.type === 'block') {
            if(!name.block) {
                throw new Error(`Expected block, got ${name.type} at ${line(name)}`);
            }
            if(name.value === '()') {
                types.push(parseType(context, new Cursor(name.block[0])));
            }
            else if(name.value === '{}') {
                // struct type
                types.push(parseStructType(context, new Cursor(name.block)));
            }
            else {
                throw new Error(`Unknown block type: ${name.value} at ${line(name)}`);
            }
        }
        else {
            if(name.type === 'identifier') {
                const type = context.build.types[name.value];
                if(!type) {
                    throw new Error(`Unknown datatype: ${name.value} at ${line(name)}`);
                }
                types.push(type);
            }
            else if(name.type === 'datatype') {
                types.push({
                    type: 'literal',
                    literal: name.value
                });
            }
        }

        writeCursor.clear();
    }

    while(!cursor.done) {
        const next = cursor.next();
        
        if(next.type === 'symbol' && next.value === '|') {
            push();
        }
        else if(next.type === 'operator' && next.value === '*') {
            push();
            const last = types.pop();
            if(!last) {
                throw new Error(`Expected type, got nothing at ${line(next)}`);
            }
            types.push({
                type: 'pointer',
                pointer: last
            });
        }
        else {
            writeCursor.push(next);
        }
    }
    if(writeCursor.size() !== 0) push();

    if(types.length === 0) {
        throw new Error(`Expected at least one type, got 0 at ${line(cursor.peek())}`);
    }
    else if(types.length === 1) {
        return types[0];
    }
    else {
        return {
            type: 'union',
            oneOf: types
        }
    }
}

export function parseTypeStatement(context: Context, cursor: Cursor<Token>) {

    const name = cursor.next();
    
    if(name.type !== 'identifier') {
        throw new Error(`Expected identifier, got ${name.type} at ${line(name)}`);
    }
    // check if type already exists
    if(context.build.types[name.value]) {
        throw new Error(`Type already exists: ${name.value} at ${line(name)}`);
    }

    if(cursor.peek().type !== 'symbol' || cursor.peek().value !== '=') {
        throw new Error(`Expected symbol '=', got ${cursor.peek().type} at ${line(name)}`);
    }
    cursor.next();

    const type = parseType(context, cursor);

    context.build.types[name.value] = type;
}