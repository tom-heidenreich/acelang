import { KEYWORDS, LexerAddon, OPERATORS, SYMBOLS, LexerPriority, IntValue, FloatValue, BooleanValue, StringValue, ReferenceValue, Token, Type, Context, Value, ValueNode, StructValue, StructType, Key, ArrayValue } from "../types";
import FieldResolve from "../util/FieldResolve";
import line, { lineInfo } from "../util/LineStringify";
import TypeCheck from "../util/TypeCheck";
import Cursor from "../util/cursor";
import { ValueAddon } from "../values";

export const DEFAULT_LEXER_ADDON: LexerAddon = {
    name: 'default',
    consumers: [
        // escape
        {
            structure: '*',
            consumer: {
                id: 'escape',
                priority: 100000,
                accept: (c) => c === '\\',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.shared.set('isEscaped', true);
                }
            }
        },
        {
            structure: '*',
            consumer: {
                id: 'escape-continue',
                priority: 100000,
                accept: (c, controller) => controller.shared.get('isEscaped'),
                willConsume: () => true,
                onConsume: (c, controller) => {
                    switch(c) {
                        case 'n': controller.append('\n'); break;
                        case 'r': controller.append('\r'); break;
                        case 't': controller.append('\t'); break;
                        case 'b': controller.append('\b'); break;
                        case 'f': controller.append('\f'); break;
                        case 'v': controller.append('\v'); break;
                        case '0': controller.append('\0'); break;
                        case '\\': controller.append('\\'); break;
                    }
                    controller.shared.set('isEscaped', false);
                }
            }
        },
        // new line
        {
            structure: '*',
            consumer: {
                id: 'new-line',
                priority: LexerPriority.HIGHER,
                accept: (c, controller) => c === '\n' || c === '\r' || (controller.shared.get('commaAsNewLine') && c === ','),
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.newLine();
                    controller.setStructure(undefined);
                }
            }
        },
        // spaces
        {
            structure: '*',
            consumer: {
                id: 'spaces',
                priority: LexerPriority.LOWER,
                accept: (c) => c === ' ' || c === '\t',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken()
                    controller.setStructure(undefined);
                }
            }
        },
        // comments
        {
            structure: '*',
            consumer: {
                id: 'comment',
                priority: 1000,
                accept: (c) => c === '#',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.setStructure('comment');
                }
            }
        },
        {
            structure: 'comment',
            consumer: {
                id: 'comment-continue',
                priority: LexerPriority.HIGH,
                accept: (c) => true,
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        },
        // blocks (curly)
        {
            structure: undefined,
            consumer: {
                id: 'block-curly-open',
                priority: LexerPriority.LOW,
                accept: (c) => c === '{',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.shared.set('curlyBlockCount', 1);
                    controller.setStructure('block-curly');
                }
            }
        },
        {
            structure: 'block-curly',
            consumer: {
                id: 'block-curly-close',
                priority: 10001,
                accept: (c) => c === '}',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    const blockCount = controller.shared.get('curlyBlockCount');
                    if(blockCount === 1) {
                        controller.createToken();
                        controller.setStructure(undefined);
                        controller.shared.delete('curlyBlockCount');
                    } else {
                        controller.shared.set('curlyBlockCount', blockCount - 1);
                        controller.append(c);
                    }
                }
            }
        },
        {
            structure: 'block-curly',
            consumer: {
                id: 'block-curly-continue',
                priority: 10000,
                accept: (c) => true,
                willConsume: () => true,
                onConsume: (c, controller) => {
                    if(c === '{') {
                        const blockCount = controller.shared.get('curlyBlockCount');
                        controller.shared.set('curlyBlockCount', blockCount + 1);
                    }
                    controller.append(c);
                }
            }
        },
        // blocks (brackets)
        {
            structure: undefined,
            consumer: {
                id: 'block-brackets-open',
                priority: LexerPriority.LOW,
                accept: (c) => c === '[',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.setStructure('block-brackets');
                    controller.shared.set('bracketsBlockCount', 1);
                }
            }
        },
        {
            structure: 'block-brackets',
            consumer: {
                id: 'block-brackets-close',
                priority: 10001,
                accept: (c) => c === ']',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    const blockCount = controller.shared.get('bracketsBlockCount');
                    if(blockCount === 1) {
                        controller.createToken();
                        controller.setStructure(undefined);
                        controller.shared.delete('bracketsBlockCount');
                    } else {
                        controller.shared.set('bracketsBlockCount', blockCount - 1);
                        controller.append(c);
                    }
                }
            }
        },
        {
            structure: 'block-brackets',
            consumer: {
                id: 'block-brackets-continue',
                priority: 10000,
                accept: (c) => true,
                willConsume: () => true,
                onConsume: (c, controller) => {
                    if(c === '[') {
                        const blockCount = controller.shared.get('bracketsBlockCount');
                        controller.shared.set('bracketsBlockCount', blockCount + 1);
                    }
                    controller.append(c);
                }
            }
        },
        // blocks (parenthesis)
        {
            structure: undefined,
            consumer: {
                id: 'block-paren-open',
                priority: LexerPriority.LOW,
                accept: (c) => c === '(',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.setStructure('block-paren');
                    controller.shared.set('parenBlockCount', 1);
                }
            }
        },
        {
            structure: 'block-paren',
            consumer: {
                id: 'block-paren-close',
                priority: 10001,
                accept: (c) => c === ')',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    const blockCount = controller.shared.get('parenBlockCount');
                    if(blockCount === 1) {
                        controller.createToken();
                        controller.setStructure(undefined);
                        controller.shared.delete('parenBlockCount');
                    } else {
                        controller.shared.set('parenBlockCount', blockCount - 1);
                        controller.append(c);
                    }
                }
            }
        },
        {
            structure: 'block-paren',
            consumer: {
                id: 'block-paren-continue',
                priority: 10000,
                accept: (c) => true,
                willConsume: () => true,
                onConsume: (c, controller) => {
                    if(c === '(') {
                        const blockCount = controller.shared.get('parenBlockCount');
                        controller.shared.set('parenBlockCount', blockCount + 1);
                    }
                    controller.append(c);
                }
            }
        },
        // symbols
        {
            structure: undefined,
            consumer: {
                id: 'symbol',
                priority: LexerPriority.LOW,
                accept: (c, controller) => controller.lexer.getRegisteredSymbols().includes(c as any),
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.setStructure('symbol');
                    controller.append(c);
                }
            }
        },
        {
            structure: 'symbol',
            consumer: {
                id: 'symbol-continue',
                priority: LexerPriority.IMPORTANT,
                accept: (c, controller) => controller.lexer.getRegisteredSymbols().includes(controller.buffer + c as any),
                willConsume: (c) => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                },
            }
        },
        {
            structure: 'symbol',
            consumer: {
                id: 'symbol-break',
                priority: LexerPriority.IMPORTANT,
                accept: (c, controller) => !controller.lexer.getRegisteredSymbols().includes(controller.buffer + c as any),
                willConsume: (c) => false,
                onChar: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                }
            }
        },
        // strings
        {
            structure: undefined,
            consumer: {
                id: 'string-double',
                priority: LexerPriority.LOW,
                accept: (c) => c === '"',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.setStructure('string-double');
                }
            }
        },
        {
            structure: undefined,
            consumer: {
                id: 'string-single',
                priority: LexerPriority.LOW,
                accept: (c) => c === "'",
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.setStructure('string-single');
                }
            }
        },
        {
            structure: 'string-double',
            consumer: {
                id: 'string-double-continue',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => c !== '"',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        },
        {
            structure: 'string-double',
            consumer: {
                id: 'string-double-break',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => c === '"',
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                }
            }
        },
        {
            structure: 'string-single',
            consumer: {
                id: 'string-single-continue',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => c !== "'",
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        },
        {
            structure: 'string-single',
            consumer: {
                id: 'string-single-break',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => c === "'",
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                }
            }
        },
        // numbers
        {
            structure: undefined,
            consumer: {
                id: 'number',
                priority: LexerPriority.LOW,
                accept: (c) => /[0-9]/.test(c),
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.setStructure('int');
                    controller.append(c);
                }
            }
        },
        {
            structure: 'int',
            consumer: {
                id: 'int-continue',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => /[0-9]/.test(c),
                willConsume: (c) => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        },
        {
            structure: 'int',
            consumer: {
                id: 'float',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => c === '.',
                willConsume: (c) => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                    controller.setStructure('float');
                }
            }
        },
        {
            structure: 'float',
            consumer: {
                id: 'float-continue',
                priority: LexerPriority.IMPORTANT,
                accept: (c) => /[0-9]/.test(c),
                willConsume: (c) => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        },
        {
            structure: 'float',
            consumer: {
                id: 'float-break',
                priority: LexerPriority.HIGH,
                accept: (c) => !/[0-9]/.test(c),
                willConsume: (c) => false,
                onChar: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                }
            }
        },
        {
            structure: 'int',
            consumer: {
                id: 'int-break',
                priority: LexerPriority.HIGH,
                accept: (c) => !/[0-9]/.test(c),
                willConsume: (c, controller) => /[a-zA-Z]/.test(c),
                onChar: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                },
                onConsume(c, controller) {
                    throw new Error(`Unexpected character '${c}' at ${lineInfo(controller.line)}`);
                },
            }
        },
        // identifiers
        {
            structure: '*',
            consumer: {
                id: 'identifier',
                priority: 0,
                accept: (c) => /[a-zA-Z_]/.test(c),
                willConsume: () => true,
                onConsume: (c, controller) => {
                    controller.append(c);
                }
            }
        }
    ],
    tokenizers: {
        none: (value, controller) => {
            if(value === '') return false;
            
            // boolean
            if(value === 'true' || value === 'false') {
                return {
                    type: 'datatype',
                    value,
                    specificType: 'boolean',
                }
            }

            if(controller.lexer.getRegisteredKeywords().includes(value)) {
                return {
                    type: 'keyword',
                    value,
                }
            }
            return {
                type: 'identifier',
                value,
            }
        },
        comment: () => false,
        symbol: (value, controller) => {
            if(controller.lexer.getRegisteredOperators().includes(value as any)) {
                return {
                    type: 'operator',
                    value,
                }
            }
            return {
                type: 'symbol',
                value,
            }
        },
        'block-curly': (value, controller) => {
            const body = controller.lex(value, {
                commaAsNewLine: true,
            })
            return {
                type: 'block',
                value: '{}',
                block: body
            }
        },
        'block-brackets': (value, controller) => {
            const body = controller.lex(value, {
                commaAsNewLine: true,
            })
            return {
                type: 'block',
                value: '[]',
                block: body
            }
        },
        'block-paren': (value, controller) => {
            const body = controller.lex(value, {
                commaAsNewLine: true,
            })
            return {
                type: 'block',
                value: '()',
                block: body
            }
        },
        'string-double': (value) => ({
            type: 'datatype',
            value,
            specificType: 'string'
        }),
        'string-single': (value) => ({
            type: 'datatype',
            value,
            specificType: 'string'
        }),
        int: (value) => ({
            type: 'datatype',
            value,
            specificType: 'int'
        }),
        float: (value) => ({
            type: 'datatype',
            value,
            specificType: 'float'
        })
    },
    register: {
        tokenTypes: [
            'keyword',
            'identifier',
            'symbol',
            'operator',
            'datatype',
            'block'
        ],
        symbols: SYMBOLS,
        operators: OPERATORS,
        dataTypes: [
            'int',
            'float',
            'string',
            'boolean'
        ],
        keywords: KEYWORDS
    }
}

export const DEFAULT_VALUES_ADDON: ValueAddon = {
    name: 'default',
    values: [
        // datatypes
        // int
        {
            tokenType: 'datatype',
            parser: {
                id: 'int',
                priority: 0,
                accept: (token) => token.specificType === 'int',
                parse: (context, token) => {
                    return {
                        type: {
                            type: 'primitive',
                            primitive: 'int'
                        },
                        value: new IntValue(parseInt(token.value))
                    }
                }
            }
        },
        // float
        {
            tokenType: 'datatype',
            parser: {
                id: 'float',
                priority: 0,
                accept: (token) => token.specificType === 'float',
                parse: (context, token) => {
                    return {
                        type: {
                            type: 'primitive',
                            primitive: 'float'
                        },
                        value: new FloatValue(parseFloat(token.value))
                    }
                }
            }
        },
        // boolean
        {
            tokenType: 'datatype',
            parser: {
                id: 'boolean',
                priority: 0,
                accept: (token) => token.specificType === 'boolean',
                parse: (context, token) => {
                    return {
                        type: {
                            type: 'primitive',
                            primitive: 'boolean'
                        },
                        value: new BooleanValue(token.value === 'true')
                    }
                }
            }
        },
        // string
        {
            tokenType: 'datatype',
            parser: {
                id: 'string',
                priority: 0,
                accept: (token) => token.specificType === 'string',
                parse: (context, token) => {
                    return {
                        type: {
                            type: 'primitive',
                            primitive: 'string'
                        },
                        value: new StringValue(token.value)
                    }
                }
            }
        },
        // identifiers
        {
            tokenType: 'identifier',
            parser: {
                id: 'identifier',
                priority: 0,
                accept: (token) => true,
                parse: (context, token) => {
                    const field = FieldResolve.resolve(context.env.fields, token.value);
                    if(!field) {
                        throw new Error(`Unknown field: ${token.value} at ${line(token)}`);
                    }
                    return {
                        type: field.type,
                        value: new ReferenceValue(token.value)
                    }
                }
            }
        },
        // blocks
        {
            tokenType: 'block',
            parser: {
                id: 'wrapped',
                priority: 0,
                accept: (token) => token.value === '()' && token.block !== undefined && token.block.length === 1,
                parse: (context, token) => {
                    return context.values.parseValue(context, new Cursor(token.block![0]));
                }
            }
        },
        // struct
        {
            tokenType: 'block',
            parser: {
                id: 'struct',
                priority: 0,
                accept: (token) => token.value === '{}' && token.block !== undefined,
                parse: (context, token) => {
                    return parseStruct(context, new Cursor(token.block!));
                }
            }
        },
        // array
        {
            tokenType: 'block',
            parser: {
                id: 'array',
                priority: 0,
                accept: (token) => token.value === '[]' && token.block !== undefined,
                parse: (context, token) => {
                    return parseArray(context, new Cursor(token.block!));
                }
            }
        }
    ]
}

function parseArray(context: Context, cursor: Cursor<Token[]>, predefinedType?: Type): ValueNode {

    const items: Value[] = []
    let type: Type | undefined;

    while(!cursor.done) {
        
        const next = cursor.next()
        const node = context.values.parseValue(context, new Cursor(next), predefinedType)
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
            value: new ArrayValue(items, predefinedType.items)
        }
    }

    return {
        type: {
            type: 'array',
            items: type,
            size: items.length
        },
        value: new ArrayValue(items, type)
    };
}

function parseStruct(context: Context, cursor: Cursor<Token[]>, predefinedType?: Type): ValueNode {
    
    const type: StructType = {
        type: 'struct',
        properties: {}
    }
    const properties: { [key: string]: Value } = {};

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

        const { type: propertyType, value: propertyValue } = context.values.parseValue(context, lineCursor.remaining(), predefinedType);

        type.properties[key] = propertyType;
        properties[key] = propertyValue
    }

    return {
        type,
        value: new StructValue(properties)
    };
}