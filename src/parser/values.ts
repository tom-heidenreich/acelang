import { Key, Context, LiteralDataType, StructValue, StructType, Token, Type, Value, ValueNode, Literal } from "../types";
import Cursor from "../util/cursor";
import ExpressionParser from "../util/ExpressionParser";
import FieldResolve from "../util/FieldResolve";
import line from "../util/LineStringify";
import TypeCheck from "../util/TypeCheck";

function parseValue(context: Context, cursor: Cursor<Token>, predefinedType?: Type): ValueNode {
    
    if(cursor.hasOnlyOne()) {
        const token = cursor.next();

        if(token.type === 'datatype') {
            if(!token.specificType) {
                throw new Error(`Unknown datatype: ${token.value} at ${line(token)}`);
            }
            let literal: Literal;

            switch(token.specificType) {
                case 'int': literal = parseInt(token.value); break;
                case 'float': literal = parseFloat(token.value); break;
                case 'string': literal = token.value; break;
                case 'boolean': literal = token.value === 'true'; break;
                default: throw new Error(`Unknown datatype: ${token.specificType} at ${line(token)}`);
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

            if(token.value === 'null' || token.value === 'undefined') {
                return {
                    type: {
                        type: 'primitive',
                        primitive: 'undefined'
                    },
                    value: {
                        type: 'undefined',
                    }
                }
            }

            const field = FieldResolve.resolve(context.env.fields, token.value);
            if(!field) {
                throw new Error(`Unknown field: ${token.value} at ${line(token)}`);
            }
            return {
                type: field.type,
                value: {
                    type: 'reference',
                    reference: token.value,
                }
            }
        }
        else if(token.type === 'block') {
            if(!token.block) {
                throw new Error(`Expected block, got ${token.type} at ${line(token)}`);
            }
            if(token.value === '()') {
                if(token.block.length !== 1) {
                    throw new Error(`Expected 1 token in block, got ${token.block.length} at ${line(token)}`);
                }
                return parseValue(context, new Cursor(token.block[0]), predefinedType);
            }
            else if(token.value === '{}') {
                return parseStruct(context, new Cursor(token.block), predefinedType)
            }
            else if(token.value === '[]') {
                return parseArray(context, new Cursor(token.block), predefinedType);
            }
            else {
                throw new Error(`Unknown block type: ${token.value} at ${line(token)}`);
            }
        }
        else {
            throw new Error(`Unknown type: ${token.type} ${token.value} at ${line(token)}`);
        }
    }
    else {
        return ExpressionParser.parse(context, cursor);
    }
}

function parseArray(context: Context, cursor: Cursor<Token[]>, predefinedType?: Type): ValueNode {

    const items: Value[] = []
    let type: Type | undefined;

    while(!cursor.done) {
        
        const next = cursor.next()
        const node = parseValue(context, new Cursor(next), predefinedType)
        if(!type) {
            type = node.type;
        }
        else if(!TypeCheck.matchesValue(context.build.types, type, node)) {
            throw new Error(`Expected type ${TypeCheck.stringify(type)}, 
            got ${TypeCheck.stringify(node.type)} at ${line(next[0])}`);
        }
        items.push(node.value);
    }

    if(!type) {
        // throw new Error(`Expected at least one value, got 0 at ${line(token)}`);
        type = {
            type: 'primitive',
            primitive: 'any'
        }
    }

    if(predefinedType) {
        if(predefinedType.type !== 'array') {
            throw new Error(`Expected array, got ${predefinedType.type} at ${line(cursor.peek()[0])}`);
        }
        return {
            type: predefinedType,
            value: {
                type: 'array',
                items,
                itemType: predefinedType.items
            }
        }
    }

    return {
        type: {
            type: 'array',
            items: type,
            size: items.length
        },
        value: {
            type: 'array',
            items,
            itemType: type
        }
    };
}

function parseStruct(context: Context, cursor: Cursor<Token[]>, predefinedType?: Type): ValueNode {
    
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
                throw new Error(`Expected string or number, got ${keyToken.specificType} at ${line(cursor.peek()[0])}`);
            }
            key = keyToken.value;
        }
        else {
            throw new Error(`Expected identifier or datatype, got ${keyToken.type} at ${line(cursor.peek()[0])}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at ${line(cursor.peek()[0])}`);
        }
        lineCursor.next();

        const { type: propertyType, value: propertyValue } = parseValue(context, lineCursor.remaining(), predefinedType);

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

function dereference(context: Context, target: ValueNode, token: Token): ValueNode {
    const { type, value } = target;
    if(type.type !== 'pointer') {
        throw new Error(`Expected pointer, got ${TypeCheck.stringify(type)} at ${line(token)}`);
    }
    return {
        type: type.pointer,
        value: {
            type: 'dereference',
            target: value,
            targetType: type.pointer
        }
    }
}

function pointerCast(context: Context, target: ValueNode, token: Token): ValueNode {
    const { type, value } = target;
    return {
        type: {
            type: 'pointer',
            pointer: type
        },
        value: {
            type: 'pointerCast',
            target: value,
            targetType: type
        }
    }
}

const Values = {
    parseValue,
    parseArray,
    parseStruct,
    stringify,
    dereference,
    pointerCast
}
export default Values 