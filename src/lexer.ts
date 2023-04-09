import StringBuffer from './util/buffer';
import { DataType, Keyword, KEYWORDS, SYMBOLS, Token, Symbol, OPERATORS, Operator, TokenType, MODIFIERS, Modifier } from './types';
import Logger from './util/logger';

// TODO: refactor whole file

function pushBuffer(LOGGER: Logger, line: Token[], buffer: StringBuffer, type?: 'datatype' | 'symbol', specificType?: DataType) {
    if(!buffer.isEmpty()) {
        const value = buffer.clear()
        let exType: TokenType | undefined = type;
        if(type === 'symbol') {  
            // check if it's an operator
            if(OPERATORS.includes(value as Operator)) {
                exType = 'operator';
            }
        }
        else if(KEYWORDS.includes(value as Keyword)) exType = 'keyword';
        else if(MODIFIERS.includes(value as Modifier)) exType = 'modifier';
        else if(value === 'null' || value === 'undefined') {
            exType = 'datatype';
            specificType = 'undefined';
        }
        else if(value === 'true' || value === 'false') {
            exType = 'datatype';
            specificType = 'boolean';
        }
        else if(SYMBOLS.includes(value as Symbol)) {
            if(OPERATORS.includes(value as Operator)) exType = 'operator';
            else exType = 'symbol';
        }
        else exType = !type ? 'identifier' : type;
        if(!exType) throw new Error(`Unknown token type: ${value}`)

        LOGGER.log(`Pushed token: ${value} (${exType}) ${specificType ? `(${specificType})` : ''}`, { detail: 2 });

        line.push({
            value,
            type: exType,
            specificType
        });
    }
}

export function lex(content: string, LOGGER: Logger, inBlock: boolean = false) {

    const result: Token[][] = []
    const line: Token[] = []

    let buffer = new StringBuffer();

    let structure: 'string' | 'int' | 'float' | 'comment' | 'block' | 'symbol' | undefined;

    let bracketType: '(' | '{' | '[' | undefined;
    let countParenthesis = 0;
    let countCurlyBrackets = 0;
    let countSquareBrackets = 0;

    let stringType: '"' | "'" | undefined;

    for(const c of content) {
        if(structure === 'comment') {
            if(c === '\n') structure = undefined;
            continue;
        }
        if(structure === 'symbol') {
            if(!SYMBOLS.includes(c as Symbol) || !SYMBOLS.includes((buffer.toString() + c) as Symbol)) {
                pushBuffer(LOGGER, line, buffer, 'symbol');
                structure = undefined;
            }
            else {
                buffer.append(c);
                continue;
            }
        }
        if(structure === 'block') {
            if(c === '{') countCurlyBrackets++;
            else if(c === '(') countParenthesis++;
            else if(c === '[') countSquareBrackets++;
            else if(c === '}' && countCurlyBrackets > 0) {
                if(--countCurlyBrackets === 0 && bracketType === '{') {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '{}',
                        type: 'block',
                        block: lex(buffer.clear(), LOGGER, true)
                    });
                    continue;
                }
            }
            else if(c === ')' && countParenthesis > 0) {
                if(--countParenthesis === 0 && bracketType === '(') {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '()',
                        type: 'block',
                        block: lex(buffer.clear(), LOGGER, true)
                    });
                    continue;
                }
            }
            else if(c === ']' && countSquareBrackets > 0) {
                if(--countSquareBrackets === 0 && bracketType === '[') {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '[]',
                        type: 'block',
                        block: lex(buffer.clear(), LOGGER, true)
                    });
                    continue;
                }
            }
            buffer.append(c);
            continue;
        }
        if(c === '{') {
            countCurlyBrackets++;
            bracketType = '{';
            pushBuffer(LOGGER, line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '(') {
            countParenthesis++;
            bracketType = '(';
            pushBuffer(LOGGER, line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '[') {
            countSquareBrackets++;
            bracketType = '[';
            pushBuffer(LOGGER, line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '"') {
            if(structure === 'string') {
                if(stringType !== '"') {
                    buffer.append(c);
                    continue;
                }
                structure = undefined;
                pushBuffer(LOGGER, line, buffer, 'datatype', 'string');
            }
            else {
                structure = 'string';
                stringType = '"';
            }
            continue;
        }
        if(c === "'") {
            if(structure === 'string') {
                if(stringType !== "'") {
                    buffer.append(c);
                    continue;
                }
                structure = undefined;
                pushBuffer(LOGGER, line, buffer, 'datatype', 'string');
            }
            else {
                structure = 'string';
                stringType = "'";
            }
            continue;
        }
        if(structure === 'string') {
            buffer.append(c);
            continue;
        }
        if(c === '#') {
            structure = 'comment';
            continue;
        }
        if(c === ' ' || c === '\t') {
            if(!structure) pushBuffer(LOGGER, line, buffer);
            else pushBuffer(LOGGER, line, buffer, 'datatype', structure);
            structure = undefined;
            continue;
        }
        if(c === '\n' || c == '\r' || c === ';' || (c === ',' && inBlock)) {
            if(!structure) pushBuffer(LOGGER, line, buffer);
            else pushBuffer(LOGGER, line, buffer, 'datatype', structure);
            structure = undefined;
            if(line.length > 0) result.push(line.splice(0));
            continue;
        }
        if(structure === 'int') {
            if(!isNaN(Number(c))) {
                buffer.append(c);
                continue;
            }
            else if(c === '.') {
                structure = 'float';
                buffer.append(c);
                continue;
            }
            else {
                if(!structure) pushBuffer(LOGGER, line, buffer);
                else pushBuffer(LOGGER, line, buffer, 'datatype', structure);
                structure = undefined;
            }
        }
        if(structure === 'float') {
            if(!isNaN(Number(c))) {
                buffer.append(c);
                continue;
            }
            else structure = undefined;
        }
        if(!isNaN(Number(c))) {
            pushBuffer(LOGGER, line, buffer);
            structure = 'int';
            buffer.append(c);
            continue;
        }
        if(SYMBOLS.includes(c as Symbol)) {
            if(structure !== 'symbol') {
                if(!structure) pushBuffer(LOGGER, line, buffer);
                else pushBuffer(LOGGER, line, buffer, 'datatype', structure);
                structure = 'symbol';
            }
            buffer.append(c);
            continue;
        }
        else buffer.append(c);
    }
    if(structure === 'int' || structure === 'float' || structure === 'string') pushBuffer(LOGGER, line, buffer, 'datatype', structure)
    else pushBuffer(LOGGER, line, buffer);
    if(line.length > 0) result.push(line);
    return result;
}