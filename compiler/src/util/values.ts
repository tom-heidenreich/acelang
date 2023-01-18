import jsep from "jsep";
import { Key, LineState, LiteralDataType, StructValue, StructType, Token, Type, Value, ValueNode, ReferenceValue } from "../types";
import Cursor from "./cursor";
import ExpressionParser from "./ExpressionParser";
import FieldResolve from "./FieldResolve";
import TypeCheck from "./TypeCheck";

function parseValue(lineState: LineState, cursor: Cursor<Token>): ValueNode {

    if(cursor.hasOnlyOne()) {
        const token = cursor.next();

        if(token.type === 'datatype') {
            if(!token.specificType) {
                throw new Error(`Unknown datatype: ${token.value} at line ${lineState.lineIndex}`);
            }
            return {
                type: {
                    type: 'primitive',
                    primitive: token.specificType
                },
                value: {
                    type: 'literal',
                    literal: token.value,
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
                type: field.type,
                value: {
                    type: 'reference',
                    reference: token.value,
                    referenceType: field.type
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
            throw new Error(`Unknown type: ${token.type} at line ${lineState.lineIndex}`);
        }
    }
    else {
        return parseExpression(lineState, cursor);
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

    const itemReferences: ReferenceValue[] = items.map((item, index) => {
        if(item.type === 'reference') {
            return item;
        }
        else {
            const reference = `__array_item_${lineState.lineIndex}_${index} (anon)`;

            lineState.env.fields.local[reference] = {
                // type cannot be undefined here
                type: type || { type: 'primitive', primitive: 'void' },
            }

            return {
                type: 'reference',
                reference,
                referenceType: type || { type: 'primitive', primitive: 'void' }
            }
        }
    });

    return {
        type: {
            type: 'array',
            items: type,
        },
        value: {
            type: 'array',
            items: itemReferences,
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

        const { type: propertyType } = parseValue(lineState, lineCursor);

        // create new anonymous field
        const reference = `__struct_property_${lineState.lineIndex}_${key} (anon)`;
        lineState.env.fields.local[reference] = {
            type: propertyType
        }

        type.properties[key] = propertyType;
        value.properties[key] = {
            type: 'reference',
            reference,
            referenceType: propertyType
        };
    }

    return {
        type,
        value
    };
}

function parseExpression(lineState: LineState, cursor: Cursor<Token>): ValueNode {
    const jsepExp = jsep(cursor.toString(token => token.value));
    // parse expression
    return ExpressionParser.parse(lineState, jsepExp)
}

const Values = {
    parseValue,
    parseArray,
    parseStruct,
    parseExpression
}
export default Values 