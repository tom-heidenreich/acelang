import StringBuffer from './util/buffer';
import { DataType, Keyword, KEYWORDS, SYMBOLS, Token, Symbol, OPERATORS, Operator, TokenType } from './types';

// TODO: refactor whole file

function pushBuffer(line: Token[], buffer: StringBuffer, type?: 'datatype' | 'symbol', specificType?: DataType) {
    if(!buffer.isEmpty()) {
        const value = buffer.clear()
        if(value.trim() === '') return;
        let exType: TokenType | undefined = type;
        if(type === 'symbol') {  
            // check if it's an operator
            if(OPERATORS.includes(value as Operator)) {
                exType = 'operator';
            }
        }
        else exType = KEYWORDS.includes(value as Keyword) ? 'keyword' : !type ? 'identifier' : type;
        if(!exType) throw new Error(`Unknown token type: ${value}`)

        line.push({
            value,
            type: exType,
            specificType
        });
    }
}

export function parse(content: string, inBlock: boolean = false) {

    const result: Token[][] = []
    const line: Token[] = []

    let buffer = new StringBuffer();

    let structure: 'string' | 'int' | 'float' | 'comment' | 'block' | 'symbol' | undefined;

    let bracketType: '(' | '{' | '[' | undefined;
    let countParenthesis = 0;
    let countCurlyBrackets = 0;
    let countSquareBrackets = 0;

    for(const c of content) {
        if(structure === 'comment') {
            if(c === '\n') structure = undefined;
            continue;
        }
        if(structure === 'symbol') {
            if(!SYMBOLS.includes(c as Symbol)) {
                pushBuffer(line, buffer, 'symbol');
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
            else if(c === '}' && bracketType === '{') {
                if(--countCurlyBrackets === 0) {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '{}',
                        type: 'block',
                        block: parse(buffer.clear(), true)
                    });
                    continue;
                }
            }
            else if(c === ')' && bracketType === '(') {
                if(--countParenthesis === 0) {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '()',
                        type: 'block',
                        block: parse(buffer.clear(), true)
                    });
                    continue;
                }
            }
            else if(c === ']' && bracketType === '[') {
                if(--countSquareBrackets === 0) {
                    bracketType = undefined;
                    structure = undefined;
                    line.push({
                        value: '[]',
                        type: 'block',
                        block: parse(buffer.clear(), true)
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
            pushBuffer(line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '(') {
            countParenthesis++;
            bracketType = '(';
            pushBuffer(line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '[') {
            countSquareBrackets++;
            bracketType = '[';
            pushBuffer(line, buffer);
            structure = 'block';
            continue;
        }
        if(c === '"') {
            if(structure === 'string') {
                structure = undefined;
                pushBuffer(line, buffer, 'datatype', 'string');
            }
            else structure = 'string';
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
            if(!structure) pushBuffer(line, buffer);
            else pushBuffer(line, buffer, 'datatype', structure);
            structure = undefined;
            continue;
        }
        if(c === '\n' || c == '\r' || c === ';' || (c === ',' && inBlock)) {
            if(!structure) pushBuffer(line, buffer);
            else pushBuffer(line, buffer, 'datatype', structure);
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
                if(!structure) pushBuffer(line, buffer);
                else pushBuffer(line, buffer, 'datatype', structure);
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
            pushBuffer(line, buffer);
            structure = 'int';
            buffer.append(c);
            continue;
        }
        if(SYMBOLS.includes(c as Symbol)) {
            if(structure !== 'symbol') {
                if(!structure) pushBuffer(line, buffer);
                else pushBuffer(line, buffer, 'datatype', structure);
                structure = 'symbol';
            }
            buffer.append(c);
            continue;
        }
        else buffer.append(c);
    }
    if(structure === 'int' || structure === 'float' || structure === 'string') pushBuffer(line, buffer, 'datatype', structure)
    else pushBuffer(line, buffer);
    if(line.length > 0) result.push(line);
    return result;
}