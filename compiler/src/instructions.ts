import { DataType, DATATYPES, Keyword, Token, Symbol, Build, Steps, ValueType, Value, Instructions, Param, Step, Call, Argument, Field, Fields } from "./types";
import Cursor, { WriteCursor } from "./util/cursor";
import FieldResolve from "./util/FieldResolve";
import TypeCheck from "./util/TypeCheck";

export function toBuildInstructions(tokens: Token[][]) {

    const build: Build = {
        functions: {},
        types: DATATYPES,
        main: {
            fields: {
                local: {},
            },
            run: [],
        }
    }

    toInstructions(tokens, build, build.main);

    return build;
}

function toInstructions(tokens: Token[][], build: Build, instructions: Instructions, lineIndex: number = 1, wrapperName?: string) {
    for(let i = 0; i < tokens.length; i++) {
        const line = tokens[i];
        if(line[0].type === 'keyword') {
            switch(line[0].value as Keyword) {
                case 'func':
                    handleFunction(build, instructions, line, lineIndex + i);
                    break;
                case 'const':
                    handleConst(build, instructions, line, lineIndex + i);
                    break;
                case 'var':
                    handleVar(build, instructions, line, lineIndex + i);
                    break;
                case 'sync':
                    handleSync(build, instructions, line, lineIndex + i);
                    break;
                case 'return':
                    handleReturn(build, instructions, line, lineIndex + i, wrapperName);
                    break;
                default:
                    throw new Error(`Unknown keyword: ${line[0].value}`);
            }
        }else {
            instructions.run.push(parseSteps(build, instructions, new Cursor(line, 0), lineIndex + i).steps);
        }
    }
    return instructions;
}

function parseSteps(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number): { steps: Steps, type?: DataType } {

    const writeCursor = new WriteCursor<Step>([]);

    let type: DataType | undefined;
    let lastToken: Token | undefined;

    while(!cursor.reachedEnd()) {

        const token = cursor.next();
        
        if(token.type === 'identifier') {
            const field = FieldResolve.resolve(instructions.fields, token.value, build.functions);
            if(!field) {
                throw new Error(`Unknown identifier: ${token.value} at line ${lineIndex}`);
            }
            if(!type) type = field.type;
            else if(type !== field.type) {
                throw new Error(`Expected ${type}, got ${field.type} at line ${lineIndex}`);
            }
            writeCursor.push(token.value);
        }
        else if(token.type === 'symbol') {
            writeCursor.push(token.value as Symbol);
        }
        else if(token.type === 'block') {
            if(!token.block) {
                throw new Error(`Expected block, got ${token.type} at line ${lineIndex}`);
            }

            // check if call
            if(token.value === '()') {

                writeCursor.rollback();

                if(lastToken && lastToken.type === 'identifier') {
                    
                    const field = FieldResolve.resolve(instructions.fields, lastToken.value, build.functions);
                    if(!field) {
                        throw new Error(`Unknown identifier: ${lastToken.value} at line ${lineIndex}`);
                    }
                    if(field.type !== 'callable') {
                        throw new Error(`Expected callable, got ${field.type} at line ${lineIndex}`);
                    }

                    const name = FieldResolve.resolveReferences(field, instructions.fields) || lastToken.value;
                    const func = build.functions[name];

                    if(!func) {
                        throw new Error(`Unknown function: ${lastToken.value} at line ${lineIndex}`);
                    }

                    const args = parseArray(build, instructions, new Cursor(token.block[0]), lineIndex).splice(0, func.params.length)

                    let argsMatch = true;
                    for(let i = 0; i < func.params.length; i++) {
                        if(!TypeCheck.matches(func.params[i].type, args[i].dataType)) {
                            argsMatch = false;
                            break;
                        }
                    }
                    if(!argsMatch) {
                        throw new Error(`Invalid arguments for function ${lastToken.value} at line ${lineIndex}`);
                    }

                    if(!type || type === 'callable') type = func.returnType
                    else if(func.returnType && type !== func.returnType) {
                        throw new Error(`Expected ${type}, got ${func.returnType} at line ${lineIndex}`);
                    }

                    writeCursor.push({
                        type: 'call',
                        name: name,
                        args,
                    });

                    continue;
                }
            }

            let content = parseSteps(build, instructions, new Cursor(token.block[0]), lineIndex);
            if(!type) type = content.type;
            else if(content.type && type !== content.type) {
                throw new Error(`Expected ${type}, got ${content.type} at line ${lineIndex}`);
            }

            writeCursor.push(token.value.split('')[0], ...content.steps.value, token.value.split('')[1]);
        }
        else if(token.type === 'datatype') {
            if(!build.types.includes(token.specificType as DataType)) {
                throw new Error(`Unknown datatype: ${token.specificType} at line ${lineIndex}`);
            }
            writeCursor.push(token.value);

            if(!type) type = token.specificType as DataType;
            else if(type !== token.specificType) {
                // TODO: auto convert
                console.log(writeCursor.asList());
                throw new Error(`Expected ${type}, got ${token.specificType} at line ${lineIndex}`);
            }
        }

        lastToken = token;
    }
    return {
        steps: {
            type: 'steps',
            value: writeCursor.asList(),
        },
        type,
    }
}

function parseArray(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number) {

    const array: Argument[] = []
    const writeCursor = new WriteCursor<Token>([]);

    function push() {
        if(writeCursor.size() === 1) {

            const token = writeCursor.asList()[0];

            if(token.type === 'identifier') {
                const field = FieldResolve.resolve(instructions.fields, token.value, build.functions);
                if(!field) {
                    throw new Error(`Unknown identifier: ${token.value} at line ${lineIndex}`);
                }
                array.push({
                    type: 'argument',
                    dataType: field.type,
                    value: token.value,
                    valueType: 'reference'
                });
            }
            else if(token.type === 'datatype') {
                if(!build.types.includes(token.specificType as DataType)) {
                    throw new Error(`Unknown datatype: ${token.specificType} at line ${lineIndex}`);
                }
                array.push({
                    type: 'argument',
                    dataType: token.specificType as DataType,
                    value: token.value,
                    valueType: 'value'
                });
            }else {
                throw new Error(`Expected datatype, got ${token.type} at line ${lineIndex}`);
            }
        }
        else {
            const steps = parseSteps(build, instructions, new Cursor(writeCursor.asList()), lineIndex)
            if(!steps.type) {
                throw new Error(`Expected datatype, got ${steps.type} at line ${lineIndex}`);
            }
            array.push({
                type: 'argument',
                dataType: steps.type,
                value: steps.steps,
                valueType: 'steps'
            });
        }
        writeCursor.clear();
    }

    while(!cursor.reachedEnd()) {
        const next = cursor.next();
        if(next.type === 'symbol' && next.value === ',') {
            push()
        }else {
            writeCursor.push(next);
        }
    }
    push();

    return array;
}

function parseParams(build: Build, cursor: Cursor<Token>, lineIndex: number) {

    const params: Param[] = [];

    const writeCursor = new WriteCursor<Token>([]);
    
    function push() {
        const cursor = new Cursor(writeCursor.asList());
        // name
        const paramName = cursor.next();
        if(paramName.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramName.type} at line ${lineIndex}`);
        }

        // type
        if(cursor.peek().type !== 'symbol' || cursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${cursor.peek().type} at line ${lineIndex}`);
        }
        cursor.next();
        const paramType = cursor.next();
        if(paramType.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramType.type} at line ${lineIndex}`);
        }
        if(!build.types.includes(paramType.value as DataType)) {
            throw new Error(`Unknown datatype: ${paramType.value} at line ${lineIndex}`);
        }

        params.push({
            name: paramName.value,
            type: paramType.value as DataType,
        });
    }

    while(!cursor.reachedEnd()) {
        if(cursor.peek().type === 'symbol' && cursor.peek().value === ',') {
            cursor.next();
            push();
            writeCursor.clear();
        }else {
            writeCursor.push(cursor.next());
        }
    }
    push();

    return params;
}

function handleFunction(build: Build, instructions: Instructions, line: Token[], lineIndex: number, isSync: boolean = false) {

    const cursor = new Cursor(line, 1);

    // name
    const name = cursor.next();
    if(name.type !== 'identifier') {
        throw new Error(`Expected identifier, got ${name.type} at line ${lineIndex}`);
    }

    // check if function already exists
    if(build.functions[name.value]) {
        throw new Error(`Function ${name.value} already exists at line ${lineIndex}`);
    }

    // // check if field already exists locally
    if(instructions.fields.local[name.value]) {
        throw new Error(`Field already exists: ${name.value} at line ${lineIndex}`);
    }

    // params
    if(cursor.peek().type !== 'block') {
        throw new Error(`Expected block, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    const block = cursor.next().block
    if(!block) {
        throw new Error(`Expected block, got ${cursor.rollback().type} at line ${lineIndex}`);
    }
    const params = parseParams(build, new Cursor(block[0]), lineIndex);

    // return type
    let returnType: DataType | undefined;
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${typeToken.type} at line ${lineIndex}`);
        }
        if(!build.types.includes(typeToken.value as DataType)) {
            throw new Error(`Unknown datatype: ${typeToken.value} at line ${lineIndex}`);
        }
        returnType = typeToken.value as DataType;
    }
    else {
        returnType = 'unknown';
    }

    // body
    if(cursor.peek().type !== 'block' || cursor.peek().value !== '{}') {
        throw new Error(`Expected block, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    const bodyToken = cursor.next().block;
    if(!bodyToken) {
        throw new Error(`Expected block, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    // convert params to fields
    const paramFields: Fields = {}
    for(const param of params) {
        paramFields[param.name] = {
            type: param.type,
        }
    }

    const bodyInstructions = {
        fields: {
            parent: instructions.fields,
            local: paramFields,
        },
        run: [],
    }

    if(!cursor.reachedEnd()) {
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // add function
    build.functions[name.value] = {
        params,
        returnType,
        body: bodyInstructions,
        isSync,
    }

    // add to fields
    instructions.fields.local[name.value] = {
        type: 'callable',
    }

    // parse body after function is added to build, so it can be accessed in the body
    const body = toInstructions(bodyToken, build, bodyInstructions, lineIndex, name.value)
    build.functions[name.value].body = body;
}

function handleConst(build: Build, instructions: Instructions, line: Token[], lineIndex: number) {

    const cursor = new Cursor(line, 1);

    // name
    const name = cursor.next();
    if(name.type !== 'identifier') {
        throw new Error(`Expected identifier, got ${name.type} at line ${lineIndex}`);
    }

    // check if already exists locally
    if(instructions.fields.local[name.value]) {
        throw new Error(`Field already exists: ${name.value} at line ${lineIndex}`);
    }

    if(cursor.peek().type !== 'symbol') {
        throw new Error(`Expected symbol, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // type
    let type: DataType | undefined;
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${typeToken.type} at line ${lineIndex}`);
        }
        if(!build.types.includes(typeToken.value as DataType)) {
            throw new Error(`Unknown datatype: ${typeToken.value} at line ${lineIndex}`);
        }
        type = typeToken.value as DataType;
    }

    // =
    if(cursor.peek().type !== 'symbol') {
        throw new Error(`Expected symbol, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    if(cursor.peek().value !== '=') {
        throw new Error(`Expected '=', got ${cursor.peek().value} at line ${lineIndex}`);
    }
    cursor.next();

    // value
    const valueToken: Token = cursor.next();
    let value: Value | Steps = valueToken.value;
    let valueType: ValueType = 'value';

    // dynamic type
    if(cursor.reachedEnd()) {
        if(valueToken.type === 'datatype') {
            if(type === undefined) {
                type = valueToken.specificType;
            }
            else if(type !== valueToken.specificType) {
                throw new Error(`Expected datatype ${type}, got ${valueToken.specificType} at line ${lineIndex}`);
            }
        }
        else if(valueToken.type === 'identifier') {
            // check if value is a field
            const resolvedField = FieldResolve.resolve(instructions.fields, valueToken.value, build.functions)
            if(resolvedField === undefined) {
                throw new Error(`Unknown field: ${valueToken.value} at line ${lineIndex}`);
            }
            if(type === undefined) {
                type = resolvedField.type;
            }
            else if(type !== resolvedField.type) {
                throw new Error(`Expected datatype ${type}, got ${resolvedField.type} at line ${lineIndex}`);
            }
            valueType = 'reference';
        }
        else {
            throw new Error(`Expected value, got ${valueToken.type} at line ${lineIndex}`);
        }
    }
    else {
        cursor.rollback()
        const steps = parseSteps(build, instructions, cursor.remaining(), lineIndex)
        value = steps.steps;
        // resolve steps
        if(!type) type = steps.type;
        else if(type !== steps.type) {
            throw new Error(`Expected datatype ${type}, got ${steps.type} at line ${lineIndex}`);
        }
        valueType = 'steps';
    }

    if(type === undefined) {
        throw new Error(`No type specified at line ${lineIndex}`);
    }

    if(!cursor.reachedEnd()) {
        console.log(cursor.peek());
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // push to fields
    instructions.fields.local[name.value] = {
        type,
        reference: valueType === 'reference' ? value as string : undefined
    };

    // add to run
    instructions.run.push({
        type: 'const',
        name: name.value,
        value,
        valueType
    });
}

function handleVar(build: Build, instructions: Instructions, line: Token[], lineIndex: number) {

    const cursor = new Cursor(line, 1);

    // name
    const name = cursor.next();
    if(name.type !== 'identifier') {
        throw new Error(`Expected identifier, got ${name.type} at line ${lineIndex}`);
    }

    // check if already exists locally
    if(instructions.fields.local[name.value]) {
        throw new Error(`Field already exists: ${name.value} at line ${lineIndex}`);
    }

    if(cursor.peek().type !== 'symbol') {
        throw new Error(`Expected symbol, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // type
    let type: DataType | undefined;
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${typeToken.type} at line ${lineIndex}`);
        }
        if(!build.types.includes(typeToken.value as DataType)) {
            throw new Error(`Unknown datatype: ${typeToken.value} at line ${lineIndex}`);
        }
        type = typeToken.value as DataType;
    }

    if(cursor.reachedEnd()) {
        if(type === undefined) {
            throw new Error(`No type specified at line ${lineIndex}`);
        }
        // push to fields
        instructions.fields.local[name.value] = {
            type,
        };

        // add to run
        instructions.run.push({
            type: 'var',
            name: name.value,
            valueType: 'value'
        });
        return;
    }

    // =
    if(cursor.peek().type !== 'symbol') {
        throw new Error(`Expected symbol, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    if(cursor.peek().value !== '=') {
        throw new Error(`Expected '=', got ${cursor.peek().value} at line ${lineIndex}`);
    }
    cursor.next();

    // value
    const valueToken: Token = cursor.next();
    let value: Value | Steps = valueToken.value;
    let valueType: ValueType = 'value';

    // dynamic type
    if(cursor.reachedEnd()) {
        if(valueToken.type === 'datatype') {
            if(type === undefined) {
                type = valueToken.specificType;
            }
            else if(type !== valueToken.specificType) {
                throw new Error(`Expected datatype ${type}, got ${valueToken.specificType} at line ${lineIndex}`);
            }
        }
        else if(valueToken.type === 'identifier') {
            // check if value is a field
            const resolvedField = FieldResolve.resolve(instructions.fields, valueToken.value, build.functions)
            if(resolvedField === undefined) {
                throw new Error(`Unknown field: ${valueToken.value} at line ${lineIndex}`);
            }
            if(type === undefined) {
                type = resolvedField.type;
            }
            else if(type !== resolvedField.type) {
                throw new Error(`Expected datatype ${type}, got ${resolvedField.type} at line ${lineIndex}`);
            }
            valueType = 'reference';
        }
        else if(valueToken.type === 'block') {
            if(!valueToken.block) {
                throw new Error(`Expected block, got ${valueToken.type} at line ${lineIndex}`);
            }
            const steps = parseSteps(build, instructions, new Cursor(valueToken.block[0]), lineIndex)
            value = steps.steps;
            // resolve steps
            if(!type) type = steps.type;
            else if(type !== steps.type) {
                throw new Error(`Expected datatype ${type}, got ${steps.type} at line ${lineIndex}`);
            }
            valueType = 'steps';
        }
        else {
            throw new Error(`Expected value, got ${valueToken.type} at line ${lineIndex}`);
        }
    }
    else {
        cursor.rollback()
        const steps = parseSteps(build, instructions, cursor.remaining(), lineIndex)
        value = steps.steps;
        // resolve steps
        if(!type) type = steps.type;
        else if(type !== steps.type) {
            throw new Error(`Expected datatype ${type}, got ${steps.type} at line ${lineIndex}`);
        }
        valueType = 'steps';
    }

    if(type === undefined) {
        throw new Error(`No type specified at line ${lineIndex}`);
    }

    if(!cursor.reachedEnd()) {
        console.log(cursor.peek());
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // push to fields
    instructions.fields.local[name.value] = {
        type,
        reference: valueType === 'reference' ? value as string : undefined
    };

    // add to run
    instructions.run.push({
        type: 'var',
        name: name.value,
        value,
        valueType
    });
}

function handleSync(build: Build, instructions: Instructions, line: Token[], lineIndex: number) {

    const cursor = new Cursor(line, 1);

    // check if sync function
    if(cursor.peek().type === 'keyword' && cursor.peek().value === 'func') {
        handleFunction(build, instructions, cursor.asList(), lineIndex, true);
        return;
    }

    // check if block
    if(cursor.peek().type !== 'block') {
        throw new Error(`Expected block, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    const block = cursor.peek().block;
    if(!block) {
        throw new Error(`Expected block, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    if(cursor.peek().value !== '{}') {
        throw new Error(`Expected '{', got ${cursor.peek().value} at line ${lineIndex}`);
    }

    // add to run
    instructions.run.push({
        type: 'sync',
        instructions: toInstructions(block, build, {
            fields: {
                parent: instructions.fields,
                local: {},
            },
            run: []
        }, lineIndex)
    });
}

function handleReturn(build: Build, instructions: Instructions, line: Token[], lineIndex: number, functionName?: string) {

    if(!functionName) {
        throw new Error(`Unexpected return at line ${lineIndex}`);
    }

    const parentFunction = build.functions[functionName];
    if(!parentFunction) {
        throw new Error(`Unknown function: ${functionName} at line ${lineIndex}`);
    }

    if(line.length === 1) {
        // return type is void
        // add to run
        instructions.run.push({
            type: 'return',
            value: undefined,
            valueType: 'value',
        })
        return;
    }

    const cursor = new Cursor(line, 1);

    // value
    const valueToken: Token = cursor.next();
    let value: Value | Steps = valueToken.value;
    let valueType: ValueType = 'value';

    let type: DataType | undefined;

    if(cursor.reachedEnd()) {
        if(valueToken.type === 'identifier') {
            // check if value is a field
            const resolvedField = FieldResolve.resolve(instructions.fields, valueToken.value, build.functions)
            if(resolvedField === undefined) {
                throw new Error(`Unknown field: ${valueToken.value} at line ${lineIndex}`);
            }
            valueType = 'reference';
        }
        else if(valueToken.type === 'datatype') {
            type = valueToken.specificType;
        }
        else {
            throw new Error(`Expected value, got ${valueToken.type} at line ${lineIndex}`);
        }
    }
    else {
        cursor.rollback()
        const steps = parseSteps(build, instructions, cursor.remaining(), lineIndex)
        value = steps.steps;
        // resolve steps
        if(!type) type = steps.type;
        else if(type !== steps.type) {
            throw new Error(`Expected datatype ${type}, got ${steps.type} at line ${lineIndex}`);
        }
        valueType = 'steps';
    }

    if(!type) {
        throw new Error(`No type specified at line ${lineIndex}`);
    }

    // dynamic type
    if(parentFunction.returnType === 'unknown') {
        // set type
        // TODO: check if setting returnType of parentFunction is enough
        build.functions[functionName].returnType = type;
    }
    // check if return type of function matches
    else if(type !== parentFunction.returnType) {
        throw new Error(`Expected return type ${parentFunction.returnType}, got ${type} at line ${lineIndex}`);
    }

    if(!cursor.reachedEnd()) {
        console.log(cursor.peek());
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // add to run
    instructions.run.push({
        type: 'return',
        value,
        valueType
    });
}