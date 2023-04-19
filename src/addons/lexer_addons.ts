import { KEYWORDS, LexerAddon, OPERATORS, SYMBOLS, LexerPriority } from "../types";

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
                accept: (c, controller) => isNaN(Number(controller.buffer)),
                willConsume: (c) => false,
                onChar: (c, controller) => {
                    controller.createToken();
                    controller.setStructure(undefined);
                }
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
            'string'
        ],
        keywords: KEYWORDS
    }
}