import StringBuffer from './buffer';

type Token = {
    value: string;
    type: 'string' | 'int' | 'float' | 'identifier' | 'symbol' | 'keyword' | 'block';
    block?: Token[][];
}

const KEYWORDS = ['const', 'var', 'func', 'sync']
const SYMBOLS = ['=', '+', '-', '*', '/', '>', '<', '^', '%', ':', ',', '.']

function pushBuffer(line: Token[], buffer: StringBuffer, type?: 'string' | 'int' | 'float' | 'symbol') {
    if(!buffer.isEmpty()) {
        const value = buffer.clear()
        const exType = KEYWORDS.includes(value) ? 'keyword' : !type ? 'identifier' : type;
        line.push({
            value,
            type: exType
        });
    }
}

export function parse(content: string) {

    const result: Token[][] = []
    const line: Token[] = []

    let buffer = new StringBuffer();

    let structure: 'string' | 'int' | 'float' | 'comment' | 'block' | undefined;

    let bracketType: '(' | '{' | '[' | undefined;
    let countParenthesis = 0;
    let countCurlyBrackets = 0;
    let countSquareBrackets = 0;

    for(const c of content) {
        if(structure === 'comment') {
            if(c === '\n') structure = undefined;
            continue;
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
                        block: parse(buffer.clear())
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
                        block: parse(buffer.clear())
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
                        block: parse(buffer.clear())
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
                pushBuffer(line, buffer, 'string');
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
            pushBuffer(line, buffer);
            continue;
        }
        if(c === '\n' || c == '\r' || c === ';') {
            pushBuffer(line, buffer, structure);
            structure = undefined;
            if(line.length > 0) result.push(line.splice(0));
            continue;
        }
        if(!isNaN(Number(c))) {
            if(structure !== 'int' && structure !== 'float') {
                pushBuffer(line, buffer);
                structure = 'int';
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
                structure = 'float';
                buffer.append(c);
                continue;
            }
            else structure = undefined;
        }
        if(structure === 'float') {
            if(!isNaN(Number(c))) {
                buffer.append(c);
                continue;
            }
            else structure = undefined;
        }
        if(SYMBOLS.includes(c)) {
            pushBuffer(line, buffer);
            line.push({
                value: c,
                type: 'symbol'
            });
            continue;
        }
        else buffer.append(c);
    }
    pushBuffer(line, buffer);
    if(line.length > 0) result.push(line);
    return result;
}