import StringBuffer from './util/buffer';
import { DataType, Keyword, KEYWORDS, SYMBOLS, Token, Symbol, OPERATORS, Operator, TokenType, MODIFIERS, Modifier, TokenLine } from './types';
import Logger from './util/logger';

// TODO: refactor whole file

function pushBuffer(LOGGER: Logger, line: Token[], buffer: StringBuffer, lineInfo: TokenLine, type?: 'datatype' | 'symbol', specificType?: DataType) {
    if(!buffer.isEmpty() || specificType === 'string') {
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

        LOGGER.log(`Pushed token: ${value} (${exType}) ${specificType ? `(${specificType})` : ''}`, { detail: 3 });

        line.push({
            value,
            type: exType,
            specificType,
            lineInfo,
        });
    }
}

function getSpecialChar(c: string) {
    switch(c) {
        case 'n': return '\n';
        case 't': return '\t';
        case 'r': return '\r';
        case '0': return '\0';
        case 'b': return '\b';
        case 'v': return '\v';
        case 'f': return '\f';
        case 'a': return '\a';
        case 'e': return '\e';
        case '\\': return '\\';
        default: return c;
    }
}

export function lex(content: string, file: string, LOGGER: Logger, inBlock: boolean = false, startingLine: number = 1, startingChar: number = 0): Token[][] {

    const result: Token[][] = []
    const line: Token[] = []

    let lineIndex = startingLine;
    let charIndex = startingChar;

    let buffer = new StringBuffer();

    type Structure = 'string' | 'int' | 'float' | 'comment' | 'block' | 'symbol' | undefined
    let structure: Structure;
    let structureLine = lineIndex
    let structureChar = charIndex

    let bracketType: '(' | '{' | '[' | undefined;
    let countParenthesis = 0;
    let countCurlyBrackets = 0;
    let countSquareBrackets = 0;

    let stringType: '"' | "'" | undefined;

    let isEscaped = false;

    function setStructure(str: Structure) {
        structureLine = lineIndex;
        structureChar = charIndex;
        structure = str;
    }

    function getLine(endCharOffset: number = 0): TokenLine {
        return {
            line: structureLine,
            char: structureChar,
            endLine: lineIndex,
            endChar: charIndex + endCharOffset,
            file
        }
    }
    for(const c of content) {
        charIndex++;
        if(c === '\n') {
            lineIndex++;
            charIndex = 0;
        }
        if(structure === 'comment') {
            if(c === '\n') setStructure(undefined);
            continue;
        }
        if(structure === 'symbol') {
            if(!SYMBOLS.includes(c as Symbol) || !SYMBOLS.includes((buffer.toString() + c) as Symbol)) {
                pushBuffer(LOGGER, line, buffer, getLine(), 'symbol');
                setStructure(undefined);
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
                    line.push({
                        value: '{}',
                        type: 'block',
                        block: lex(buffer.clear(), file, LOGGER, true, structureLine, structureChar),
                        lineInfo: getLine(1)
                    });
                    setStructure(undefined);
                    continue;
                }
            }
            else if(c === ')' && countParenthesis > 0) {
                if(--countParenthesis === 0 && bracketType === '(') {
                    bracketType = undefined;
                    line.push({
                        value: '()',
                        type: 'block',
                        block: lex(buffer.clear(), file, LOGGER, true, structureLine, structureChar),
                        lineInfo: getLine(1)
                    });
                    setStructure(undefined);
                    continue;
                }
            }
            else if(c === ']' && countSquareBrackets > 0) {
                if(--countSquareBrackets === 0 && bracketType === '[') {
                    bracketType = undefined;
                    line.push({
                        value: '[]',
                        type: 'block',
                        block: lex(buffer.clear(), file, LOGGER, true, structureLine, structureChar),
                        lineInfo: getLine(1)
                    });
                    setStructure(undefined);
                    continue;
                }
            }
            buffer.append(c);
            continue;
        }
        if(c === '{') {
            countCurlyBrackets++;
            bracketType = '{';
            pushBuffer(LOGGER, line, buffer, getLine());
            setStructure('block');
            continue;
        }
        if(c === '(') {
            countParenthesis++;
            bracketType = '(';
            pushBuffer(LOGGER, line, buffer, getLine());
            setStructure('block');
            continue;
        }
        if(c === '[') {
            countSquareBrackets++;
            bracketType = '[';
            pushBuffer(LOGGER, line, buffer, getLine());
            setStructure('block');
            continue;
        }
        if(c === '"') {
            if(structure === 'string') {
                if(stringType !== '"') {
                    buffer.append(c);
                    continue;
                }
                pushBuffer(LOGGER, line, buffer, getLine(1), 'datatype', 'string');
                setStructure(undefined);
            }
            else {
                setStructure('string');
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
                pushBuffer(LOGGER, line, buffer, getLine(1), 'datatype', 'string');
                setStructure(undefined);
            }
            else {
                setStructure('string');
                stringType = "'";
            }
            continue;
        }
        if(structure === 'string') {
            if(c === '\\' && !isEscaped) {
                isEscaped = true;
                continue;
            }
            if(isEscaped) {
                buffer.append(getSpecialChar(c));
                isEscaped = false;
                continue;
            }
                
            buffer.append(c);
            continue;
        }
        if(c === '#') {
            setStructure('comment');
            continue;
        }
        if(c === ' ' || c === '\t') {
            if(!structure || structure === 'symbol') pushBuffer(LOGGER, line, buffer, getLine());
            else pushBuffer(LOGGER, line, buffer, getLine(), 'datatype', structure);
            setStructure(undefined);
            continue;
        }
        if(c === '\n' || c == '\r' || c === ';' || (c === ',' && inBlock)) {
            if(!structure || structure === 'symbol') pushBuffer(LOGGER, line, buffer, getLine());
            else pushBuffer(LOGGER, line, buffer, getLine(), 'datatype', structure);
            setStructure(undefined);
            if(line.length > 0) result.push(line.splice(0));
            continue;
        }
        if(SYMBOLS.includes(c as Symbol)) {
            if(structure !== 'symbol') {
                if(!structure) pushBuffer(LOGGER, line, buffer, getLine());
                else pushBuffer(LOGGER, line, buffer, getLine(), 'datatype', structure);
                setStructure('symbol');
            }
            buffer.append(c);
            continue;
        }
        if(structure === 'int') {
            if(!isNaN(Number(c))) {
                buffer.append(c);
                continue;
            }
            else if(c === '.') {
                setStructure('float');
                buffer.append(c);
                continue;
            }
            else {
                if(!structure) pushBuffer(LOGGER, line, buffer, getLine());
                else pushBuffer(LOGGER, line, buffer, getLine(), 'datatype', structure);
                setStructure(undefined);
            }
        }
        if(structure === 'float') {
            if(!isNaN(Number(c))) {
                buffer.append(c);
                continue;
            }
            else setStructure(undefined);
        }
        if(!isNaN(Number(c))) {
            pushBuffer(LOGGER, line, buffer, getLine());
            setStructure('int');
            buffer.append(c);
            continue;
        }
        else buffer.append(c);
    }
    if(structure === 'int' || structure === 'float' || structure === 'string') pushBuffer(LOGGER, line, buffer, getLine(1), 'datatype', structure)
    else pushBuffer(LOGGER, line, buffer, getLine(1));
    if(line.length > 0) result.push(line);
    return result;
}