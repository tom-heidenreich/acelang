import { Key, LineState, LiteralDataType, StructValue, StructType, Token, Type, Value, ValueNode, Literal } from "../types";
import Cursor from "../util/cursor";
import ExpressionParser from "../util/ExpressionParser";
import FieldResolve from "../util/FieldResolve";
import TypeCheck from "../util/TypeCheck";

function parseValue(lineState: LineState, cursor: Cursor<Token>): ValueNode {
    
    if(cursor.hasOnlyOne()) {
        const token = cursor.next();

        if(token.type === 'datatype') {
            if(!token.specificType) {
                throw new Error(`Unknown datatype: ${token.value} at line ${lineState.lineIndex}`);
            }
            let literal: Literal;

            switch(token.specificType) {
                case 'int': literal = parseInt(token.value); break;
                case 'float': literal = parseFloat(token.value); break;
                case 'string': literal = token.value; break;
                case 'boolean': literal = token.value === 'true'; break;
                default: throw new Error(`Unknown datatype: ${token.specificType} at line ${lineState.lineIndex}`);
            }

            return {
                type: {
                    type: 'primitive',
                    primitive: token.specificType
                },
                value: {
                    type: 'literal',
                    literal,
                    literalType: token.specificType as LiteralDataType
                }
            }
        }
        else if(token.type === 'identifier') {

            const field = FieldResolve.resolve(lineState.env.fields, token.value);
            if(!field) {
                throw new Error(`Unknown field: ${token.value} at line ${lineState.lineIndex}`);
            }

            return {
                type: {
                    type: 'pointer',
                    pointer: field.type
                },
                value: {
                    type: 'reference',
                    reference: token.value,
                }
            }
        }
        else if(token.type === 'block') {
            if(!token.block) {
                throw new Error(`Expected block, got ${token.type} at line ${lineState.lineIndex}`);
            }
            if(token.value === '()') {
                if(token.block.length !== 1) {
                    throw new Error(`Expected 1 token in block, got ${token.block.length} at line ${lineState.lineIndex}`);
                }
                return parseValue(lineState, new Cursor(token.block[0]));
            }
            else if(token.value === '{}') {
                return parseStruct(lineState, new Cursor(token.block),)
            }
            else if(token.value === '[]') {
                return parseArray(lineState, new Cursor(token.block));
            }
            else {
                throw new Error(`Unknown block type: ${token.value} at line ${lineState.lineIndex}`);
            }
        }
        else {
            throw new Error(`Unknown type: ${token.type} ${token.value} at line ${lineState.lineIndex}`);
        }
    }
    else if(cursor.peek().type === 'operator' && cursor.peek().value === '*') {
        cursor.next();
        const { type, value } = parseValue(lineState, cursor);
        if(type.type !== 'pointer') {
            throw new Error(`Expected pointer, got ${type.type} at line ${lineState.lineIndex}`);
        }
        return {
            type: type.pointer,
            value: {
                type: 'dereference',
                target: value
            }
        }
    }   
    else {
        return ExpressionParser.parse(lineState, cursor);
    }
}

function parseArray(lineState: LineState, cursor: Cursor<Token[]>): ValueNode {

    const items: Value[] = []
    let type: Type | undefined;

    while(!cursor.done) {
        
        const node = parseValue(lineState, new Cursor(cursor.next()))
        if(!type) {
            type = node.type;
        }
        else if(!TypeCheck.matchesValue(lineState.build.types, type, node)) {
            throw new Error(`Expected type ${TypeCheck.stringify(type)}, 
            got ${TypeCheck.stringify(node.type)} at line ${lineState.lineIndex}`);
        }
        items.push(node.value);
    }

    if(!type) {
        throw new Error(`Expected at least one value, got 0 at line ${lineState.lineIndex}`);
    }

    return {
        type: {
            type: 'array',
            items: type,
        },
        value: {
            type: 'array',
            items,
        }
    };
}

function parseStruct(lineState: LineState, cursor: Cursor<Token[]>): ValueNode {
    
    const type: StructType = {
        type: 'struct',
        properties: {}
    }
    const value: StructValue = {
        type: 'struct',
        properties: {}
    }

    while(!cursor.done) {
        const lineCursor = new Cursor(cursor.next());

        const keyToken = lineCursor.next();
        let key: Key;

        if(keyToken.type === 'identifier') {
            key = keyToken.value;
        }
        else if(keyToken.type === 'datatype') {
            if(keyToken.specificType !== 'string' && keyToken.specificType !== 'int') {
                throw new Error(`Expected string or number, got ${keyToken.specificType} at line ${lineState.lineIndex}`);
            }
            key = keyToken.value;
        }
        else {
            throw new Error(`Expected identifier or datatype, got ${keyToken.type} at line ${lineState.lineIndex}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineState.lineIndex}`);
        }
        lineCursor.next();

        const { type: propertyType, value: propertyValue } = parseValue(lineState, lineCursor);

        type.properties[key] = propertyType;
        value.properties[key] = propertyValue
    }

    return {
        type,
        value
    };
}

function stringify(value: Value): string {
    switch(value.type) {
        case 'literal': return value.literal.toString();
        case 'reference': return value.reference;
        case 'array': return `[${value.items.map(stringify).join(', ')}]`;
        case 'struct': return `{${Object.entries(value.properties).map(([key, value]) => `${key}: ${stringify(value)}`).join(', ')}}`;
    }
    throw new Error(`Unknown value type: ${value}`);
}

const Values = {
    parseValue,
    parseArray,
    parseStruct,
    stringify,
}
export default Values 