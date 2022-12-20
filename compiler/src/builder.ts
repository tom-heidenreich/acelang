import { DataType, DATATYPES, Keyword, Token } from "./parser";
import Cursor from "./util/cursor";

type Parameter = {
    name: string;
    type: DataType;
}

type Function = {
    name: string;
    parameters: Parameter[];
    returnType: DataType;
    body: Instructions;
}

type Const = {
    name: string;
    type: DataType;
    value: string;
}

type Var = {
    name: string;
    type: DataType;
    value?: string;
}

type Instruction = {
    type: 'const' | 'var';
    data: Const | Var;
}

type InstructionAddress = string;

type Instructions = {
    declared: {
        functions: Function[],
        fields: {[key: InstructionAddress]: Instruction}
    },
    main: InstructionAddress[];
}

export function toBuildInstructions(tokens: Token[][]) {

    const instructions: Instructions = {
        declared: {
            functions: [],
            fields: {},
        },
        main: [],
    }

    for(let i = 0; i < tokens.length; i++) {
        const line = tokens[i];
        for(const token of line) {
            if(token.type === 'keyword') {
                switch(token.value as Keyword) {
                    case 'func':
                        handleFunction(instructions, line, i+1);
                        break;
                    case 'const':
                        handleConst(instructions, line, i+1);
                        break;
                    case 'var':
                        handleVar(instructions, line, i+1);
                        break;
                    case 'sync':
                        handleSync(instructions, line, i+1);
                        break;
                    default:
                        throw new Error(`Unknown keyword: ${token.value}`);
                }
            }
        }
    }

    return instructions;
}

function createField(instr: Instructions, intruction: Instruction) {
    // create unique hex address
    let address = '';
    do {
        address = '0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16);
    } while(instr.declared.fields[address]);
    instr.declared.fields[address] = intruction;
    instr.main.push(address);
    return address;
}

function checkIfDeclared(instr: Instructions, name: string) {
    let declared = false;
    Object.keys(instr.declared.fields).forEach(key => {
        if(instr.declared.fields[key].data.name === name) {
            declared = true;
        }
    });
    if(declared) return true;
    instr.declared.functions.forEach(func => {
        if(func.name === name) {
            declared = true;
        }
    });
    return declared;
}

function getFieldByName(instr: Instructions, name: string) {
    let address: string | undefined;
    let field: Instruction | undefined;
    Object.keys(instr.declared.fields).forEach(key => {
        if(instr.declared.fields[key].data.name === name) {
            address = key;
            field = instr.declared.fields[key];
        }
    });
    if(!field) return undefined;
    return {
        address,
        ...field
    };
}

function handleFunction(instr: Instructions, line: Token[], lineIndex: number) {
    
    const cursor = new Cursor(line, 1);

    // identifier
    const identifier = cursor.next();
    if(identifier.type !== 'identifier') throw new Error(`Expected identifier, got ${identifier.type} '${identifier.value}' in line ${lineIndex}`);
    if(checkIfDeclared(instr, identifier.value)) throw new Error(`Identifier '${identifier.value}' already declared in line ${lineIndex}`);

    // parameters
    const parameters: Parameter[] = [];
    if(cursor.peek().type === 'block' && cursor.peek().value === '()') {
        const parameterTokens = cursor.next().block;
        if(!parameterTokens) throw new Error(`Expected block, got ${cursor.peek().type} '${cursor.peek().value}' in line ${lineIndex}`);
        for(const parameterToken of parameterTokens) {
            
            const parameterCursor = new Cursor(parameterToken);

            const parameterName = parameterCursor.next();
            if(parameterName.type !== 'identifier') throw new Error(`Expected identifier, got ${parameterName.type} '${parameterName.value}' in line ${lineIndex}`);
            
            // expect colon
            if(parameterCursor.peek().type !== 'symbol' && parameterCursor.peek().value !== ':') {
                throw new Error(`Expected ':', got ${parameterCursor.peek().value} in line ${lineIndex}`);
            }
            parameterCursor.next();

            const parameterType = parameterCursor.next();
            if(parameterType.type !== 'identifier') {
                throw new Error(`Expected identifier, got ${parameterType.type} '${parameterType.value}' in line ${lineIndex}`);
            }
            if(!DATATYPES.includes(parameterType.value)) {
                throw new Error(`Unknown datatype: ${parameterType.value} in line ${lineIndex}`);
            }

            parameters.push({
                name: parameterName.value,
                type: parameterType.specificType as DataType
            });
        }
    }

    // return type
    let returnType: DataType | undefined;
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next();
        const type = cursor.next();
        if(type.type !== 'identifier') throw new Error(`Expected identifier, got ${type.type} '${type.value}' in line ${lineIndex}`);
        if(!DATATYPES.includes(type.value)) throw new Error(`Unknown datatype: ${type.value} in line ${lineIndex}`);
        returnType = type.value as DataType;
    }
    if(!returnType) throw new Error(`Expected return type in line ${lineIndex}`);

    // body
    if(cursor.peek().type !== 'block') throw new Error(`Expected block, got ${cursor.peek().type} '${cursor.peek().value}' in line ${lineIndex}`);
    const body = toBuildInstructions(cursor.next().block as Token[][]);

    if(!cursor.reachedEnd()) {
        throw new Error(`Unexpected token '${cursor.peek().value}' in line ${lineIndex}`)
    }

    instr.declared.functions.push({
        name: identifier.value,
        parameters,
        returnType,
        body
    });
}

function handleConst(instr: Instructions, line: Token[], lineIndex: number) {

    const cursor = new Cursor(line, 1);

    // identifier
    const identifier = cursor.next();
    if(identifier.type !== 'identifier') throw new Error(`Expected identifier, got ${identifier.type} '${identifier.value}' in line ${lineIndex}`);
    if(checkIfDeclared(instr, identifier.value)) throw new Error(`Identifier '${identifier.value}' already declared in line ${lineIndex}`);
    
    // type
    if(cursor.peek().type !== 'symbol') throw new Error(`Expected symbol, got ${cursor.peek().value} in line ${lineIndex}`);
    let type: DataType | undefined;
    // type specified
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next()
        if(typeToken.type !== 'identifier') throw new Error(`Expected identifier, got ${typeToken.type} '${typeToken.value}' in line ${lineIndex}`);
        if(!DATATYPES.includes(typeToken.value)) throw new Error(`Unknown datatype: ${typeToken.value} in line ${lineIndex}`);
        type = typeToken.value as DataType;
    }

    // value
    if(cursor.next().value !== '=') throw new Error(`Expected '=', got ${cursor.rollback().value} in line ${lineIndex}`);
    const value = cursor.next();
    if(value.type !== 'datatype') {
        if(value.type !== 'identifier') throw new Error(`Expected datatype, got ${value.type} in line ${lineIndex}`);
        const field = getFieldByName(instr, value.value);
        if(!field) throw new Error(`Unknown identifier: ${value.value} in line ${lineIndex}`);
        type = field.data.type;
        if(field.data.value) value.value = field.data.value;
        else throw new Error(`Cannot assign to non-addressable field: ${value.value} in line ${lineIndex}`);
    }
    if(type && value.specificType && type !== value.specificType) throw new Error(`Type mismatch: ${type} !== ${value.specificType} in line ${lineIndex}`);
    if(!type) type = value.specificType;

    if(!type) throw new Error(`Type not specified in line ${lineIndex}`)

    if(!cursor.reachedEnd()) throw new Error(`Unexpected token: ${cursor.next().value} in line ${lineIndex}`)
    
    createField(instr, {
        type: 'const',
        data: {
            name: identifier.value,
            type: type,
            value: value.value,
        }
    })
}

function handleVar(instr: Instructions, line: Token[], lineIndex: number) {
    
    const cursor = new Cursor(line, 1);

    // identifier
    const identifier = cursor.next();
    if(identifier.type !== 'identifier') throw new Error(`Expected identifier, got ${identifier.type} '${identifier.value}' in line ${lineIndex}`);
    if(checkIfDeclared(instr, identifier.value)) throw new Error(`Identifier '${identifier.value}' already declared in line ${lineIndex}`);
    
    // type
    if(cursor.peek().type !== 'symbol') throw new Error(`Expected symbol, got ${cursor.peek().value} in line ${lineIndex}`);
    let type: DataType | undefined;
    // type specified
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') throw new Error(`Expected identifier, got ${typeToken.type} '${typeToken.value}' in line ${lineIndex}`);
        if(!DATATYPES.includes(typeToken.value)) throw new Error(`Unknown datatype: ${typeToken.value} in line ${lineIndex}`);
        type = typeToken.value as DataType;
    }

    if(cursor.reachedEnd()) {
        if(!type) throw new Error(`Type not specified in line ${lineIndex}`)

        createField(instr, {
            type: 'var',
            data: {
                name: identifier.value,
                type: type,
            }
        })
        return;
    }

    // value
    if(cursor.next().value !== '=') throw new Error(`Expected '=', got ${cursor.rollback().value} in line ${lineIndex}`);
    const value = cursor.next();
    if(value.type !== 'datatype') {
        if(value.type !== 'identifier') throw new Error(`Expected datatype, got ${value.type} in line ${lineIndex}`);
        if(!checkIfDeclared(instr, value.value)) throw new Error(`Field ${value.value} is not initialized in line ${lineIndex}`)
    }
    if(type && type !== value.specificType) throw new Error(`Type mismatch: ${type} !== ${value.specificType} in line ${lineIndex}`);
    if(!type) type = value.specificType;

    if(!type) throw new Error(`Type not specified in line ${lineIndex}`)

    if(!cursor.reachedEnd()) throw new Error(`Unexpected token: ${cursor.next().value} in line ${lineIndex}`)

    createField(instr, {
        type: 'var',
        data: {
            name: identifier.value,
            type: type,
            value: value.value,
        }
    })
}

function handleSync(instr: Instructions, line: Token[], lineIndex: number) {
                
}