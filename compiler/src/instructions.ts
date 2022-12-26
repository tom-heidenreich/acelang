import { DATATYPES, Keyword, Token, Symbol, Build, Steps, Value, Instructions, Param, Step, Argument, Fields, Types, Type, StructType, Struct, ArrayValue, Key } from "./types";
import Cursor, { WriteCursor } from "./util/cursor";
import FieldResolve from "./util/FieldResolve";
import TypeCheck from "./util/TypeCheck";

export function toBuildInstructions(tokens: Token[][]) {

    const defaultTypes: Types = {}
    DATATYPES.forEach(type => {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type
        }
    })

    const build: Build = {
        functions: {},
        types: defaultTypes,
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
    lineIndex++
    for(let i = 0; i < tokens.length; i++) {
        const line = tokens[i];
        if(line[0].type === 'keyword') {
            const cursor = new Cursor(line, 1);
            switch(line[0].value as Keyword) {
                case 'func':
                    handleFunction(build, instructions, cursor, lineIndex);
                    break;
                case 'const':
                    handleConst(build, instructions, cursor, lineIndex);
                    break;
                case 'var':
                    handleVar(build, instructions, cursor, lineIndex);
                    break;
                case 'sync':
                    handleSync(build, instructions, cursor, lineIndex);
                    break;
                case 'return':
                    handleReturn(build, instructions, cursor, lineIndex, wrapperName);
                    break;
                case 'type':
                    handleType(build, instructions, cursor, lineIndex);
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

// functions
function parseParams(build: Build, cursor: Cursor<Token[]>, lineIndex: number) {

    const params: Param[] = [];

    while(!cursor.reachedEnd()) {

        const lineCursor = new Cursor(cursor.next());

        // name
        const paramName = lineCursor.next();
        if(paramName.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramName.type} at line ${lineIndex}`);
        }

        // type
        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineIndex}`);
        }
        lineCursor.next();
        const paramType = lineCursor.next();
        if(paramType.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramType.type} at line ${lineIndex}`);
        }
        if(!build.types[paramType.value]) {
            throw new Error(`Unknown datatype: ${paramType.value} at line ${lineIndex}`);
        }

        params.push({
            name: paramName.value,
            type: build.types[paramType.value],
        });
    }

    return params;
}

function parseArguments(build: Build, instructions: Instructions, cursor: Cursor<Token[]>, lineIndex: number) {

    const value: Argument[] = []

    while(!cursor.reachedEnd()) {
        const valueResult = parseValue(build, instructions, new Cursor(cursor.next()), lineIndex)
        value.push({
            type: 'argument',
            dataType: valueResult.type,
            value: valueResult.value,
        });
    }

    return value;
}

// types
function parseStructType(build: Build, cursor: Cursor<Token[]>, lineIndex: number): StructType {

    const struct: Types = {}

    while(!cursor.reachedEnd()) {
        const lineCursor = new Cursor(cursor.next());

        const key = lineCursor.next();
        if(key.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${key.type} at line ${lineIndex}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineIndex}`);
        }
        lineCursor.next();

        const value = parseType(build, lineCursor, lineIndex);

        struct[key.value] = value;
    }

    return {
        type: 'struct',
        properties: struct,
    };
}

function parseType(build: Build, cursor: Cursor<Token>, lineIndex: number): Type {

    let types: Type[] = [];
    const writeCursor = new WriteCursor<Token>([]);

    function push() {
        
        const cursor = new Cursor(writeCursor.asList());
        const name = cursor.next();

        // array type
        if(!cursor.reachedEnd()) {
            const next = cursor.next();
            if(next.type !== 'block' || next.value !== '[]') {
                throw new Error(`Expected block '[]', got ${next.type} at line ${lineIndex}`);
            }
            if(!next.block) {
                throw new Error(`Expected block, got ${next.type} at line ${lineIndex}`);
            }
            if(name.type === 'identifier') {
                if(!build.types[name.value]) {
                    throw new Error(`Unknown datatype: ${name.value} at line ${lineIndex}`);
                }
                types.push({
                    type: 'array',
                    items: {
                        type: 'reference',
                        reference: name.value
                    }
                });
            }
            else if(name.type === 'datatype') {
                types.push({
                    type: 'array',
                    items: {
                        type: 'literal',
                        literal: name.value
                    }
                });
            }
            else if(name.type === 'block') {
                if(!name.block) {
                    throw new Error(`Expected block, got ${name.type} at line ${lineIndex}`);
                }
                types.push({
                    type: 'array',
                    items: parseType(build, new Cursor(name.block[0]), lineIndex)
                });
            }
            else {
                throw new Error(`Unknown type: ${name.type} at line ${lineIndex}`);
            }
        }
        else if(name.type === 'block') {
            if(!name.block) {
                throw new Error(`Expected block, got ${name.type} at line ${lineIndex}`);
            }
            if(name.value === '()') {
                types.push(parseType(build, new Cursor(name.block[0]), lineIndex));
            }
            else if(name.value === '{}') {
                // struct type
                types.push(parseStructType(build, new Cursor(name.block), lineIndex));
            }
            else {
                throw new Error(`Unknown block type: ${name.value} at line ${lineIndex}`);
            }
        }
        else {
            if(name.type === 'identifier') {
                if(!build.types[name.value]) {
                    throw new Error(`Unknown datatype: ${name.value} at line ${lineIndex}`);
                }

                types.push({
                    type: 'reference',
                    reference: name.value
                });
            }
            else if(name.type === 'datatype') {
                types.push({
                    type: 'literal',
                    literal: name.value
                });
            }
        }

        writeCursor.clear();
    }

    while(!cursor.reachedEnd()) {
        const next = cursor.next();
        
        if(next.type === 'symbol' && next.value === '|') {
            push();
        }else {
            writeCursor.push(next);
        }
    }
    push();

    if(types.length === 0) {
        throw new Error(`Expected at least one type, got 0 at line ${lineIndex}`);
    }
    else if(types.length === 1) {
        return types[0];
    }
    else {
        return {
            type: 'union',
            oneOf: types
        }
    }
}

// steps
function parseSteps(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number): { steps: Steps, type?: Type } {

    const writeCursor = new WriteCursor<Step>([]);

    let type: Type | undefined;
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

            // check if access
            // TODO: access last object not just last identifier
            if(lastToken && lastToken.type === 'identifier') {
                writeCursor.rollback();
                const field = FieldResolve.resolve(instructions.fields, lastToken.value, build.functions);
                if(!field) {
                    throw new Error(`Unknown identifier: ${lastToken.value} at line ${lineIndex}`);
                }
                const name = FieldResolve.resolveReferences(field, instructions.fields) || lastToken.value;

                // check if function call
                if(token.value === '()') {
                    
                    if(!TypeCheck.matchesPrimitive(build.types, field.type, 'callable')) {
                        throw new Error(`Expected callable, got ${field.type} at line ${lineIndex}`);
                    }

                    const func = build.functions[name];
                    if(!func) {
                        throw new Error(`Unknown function: ${lastToken.value} at line ${lineIndex}`);
                    }

                    const args = parseArguments(build, instructions, new Cursor(token.block), lineIndex).splice(0, func.params.length)
                    console.log(args);

                    for(let i = 0; i < func.params.length; i++) {
                        const param = func.params[i];
                        const arg = args[i];
                        if(!param) {
                            throw new Error(`Too many arguments for function ${lastToken.value} at line ${lineIndex}`);
                        }
                        else if(!arg) {
                            throw new Error(`Not enough arguments for function ${lastToken.value} at line ${lineIndex}`);
                        }
                        else if(!TypeCheck.matches(build.types, param.type, arg.dataType)) {
                            throw new Error(`Invalid arguments for function ${lastToken.value} at line ${lineIndex}`);
                        }
                    }

                    if(!type || TypeCheck.matchesPrimitive(build.types, type, 'callable')) type = func.returnType
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
                // check if object access
                else if(token.value === '[]') {

                    if(!TypeCheck.matchesPrimitive(build.types, field.type, 'object')) {
                        throw new Error(`Expected object, got ${field.type} at line ${lineIndex}`);
                    }
                    if(token.block.length !== 1) {
                        throw new Error(`Expected 1 argument for object access, got ${token.block.length} at line ${lineIndex}`);
                    }

                    const valueResult = parseValue(build, instructions, new Cursor(token.block[0]), lineIndex);
                    if(valueResult.value.type !== 'primitive') {
                        throw new Error(`Expected primitive, got ${valueResult.value.type} at line ${lineIndex}`);
                    }

                    if(!type || TypeCheck.matchesPrimitive(build.types, type, 'object')) {
                        let key = valueResult.value.primitive;
                        if(typeof valueResult.value.primitive === 'boolean') {
                            key = valueResult.value.primitive ? 'true' : 'false';
                        }
                        const resolvedType = TypeCheck.resolveObject(build.types, field.type, key as Key);
                        if(resolvedType) type = resolvedType;
                    }
                    else if(field.type && type !== field.type) {
                        throw new Error(`Expected ${type}, got ${field.type} at line ${lineIndex}`);
                    }

                    writeCursor.push({
                        type: 'access',
                        name: name,
                        key: valueResult.value.primitive,
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
            if(!build.types[token.specificType as string]) {
                throw new Error(`Unknown datatype: ${token.specificType} at line ${lineIndex}`);
            }
            writeCursor.push(token.value);

            if(!type) type = build.types[token.specificType as string];
            else if(token.specificType && !TypeCheck.matchesPrimitive(build.types, type, token.specificType)) {
                // TODO: auto convert
                console.log(writeCursor.asList());
                throw new Error(`Expected ${type.type}, got ${token.specificType} at line ${lineIndex}`);
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

// values
function parseArray(build: Build, instructions: Instructions, cursor: Cursor<Token[]>, lineIndex: number): { type: Type, value: ArrayValue } {

    const value: Value[] = []
    let type: Type | undefined;

    while(!cursor.reachedEnd()) {
        
        const valueResult = parseValue(build, instructions, new Cursor(cursor.next()), lineIndex)
        if(!type) {
            type = valueResult.type;
        }
        else if(!TypeCheck.matchesValue(build.types, type, valueResult)) {
            throw new Error(`Expected type ${TypeCheck.stringify(type)}, got ${TypeCheck.stringify(valueResult.type)} at line ${lineIndex}`);
        }
        value.push(valueResult.value);
    }

    if(!type) {
        throw new Error(`Expected at least one value, got 0 at line ${lineIndex}`);
    }

    return {
        type: {
            type: 'array',
            items: type,
        },
        value: {
            type: 'array',
            items: value
        }
    };
}

function parseStruct(build: Build, instructions: Instructions, cursor: Cursor<Token[]>, lineIndex: number): {type: Type, value: Struct} {
    
    const type: StructType = {
        type: 'struct',
        properties: {}
    }
    const value: Struct = {
        type: 'struct',
        properties: {}
    }

    while(!cursor.reachedEnd()) {
        const lineCursor = new Cursor(cursor.next());

        const keyToken = lineCursor.next();
        let key: Key;

        if(keyToken.type === 'identifier') {
            key = keyToken.value;
        }
        else if(keyToken.type === 'datatype') {
            if(keyToken.specificType !== 'string' && keyToken.specificType !== 'int') {
                throw new Error(`Expected string or number, got ${keyToken.specificType} at line ${lineIndex}`);
            }
            key = keyToken.value;
        }
        else {
            throw new Error(`Expected identifier or datatype, got ${keyToken.type} at line ${lineIndex}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineIndex}`);
        }
        lineCursor.next();

        const {type: propertyType, value: propertyValue} = parseValue(build, instructions, lineCursor, lineIndex);

        type.properties[key] = propertyType;
        value.properties[key] = propertyValue;
    }

    return {
        type,
        value
    };
}

function parseValue(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number): {type: Type, value: Value} {

    if(cursor.hasOnlyOne()) {
        const token = cursor.next();

        if(token.type === 'datatype') {
            if(!token.specificType) {
                throw new Error(`Unknown datatype: ${token.value} at line ${lineIndex}`);
            }
            return {
                type: {
                    type: 'primitive',
                    primitive: token.specificType
                },
                value: {
                    type: 'primitive',
                    primitive: token.value
                }
            }
        }
        else if(token.type === 'identifier') {

            const field = FieldResolve.resolve(instructions.fields, token.value);
            if(!field) {
                throw new Error(`Unknown field: ${token.value} at line ${lineIndex}`);
            }

            return {
                type: field.type,
                value: {
                    type: 'reference',
                    reference: token.value
                }
            }
        }
        else if(token.type === 'block') {
            if(!token.block) {
                throw new Error(`Expected block, got ${token.type} at line ${lineIndex}`);
            }
            if(token.value === '()') {
                if(token.block.length !== 1) {
                    throw new Error(`Expected 1 token in block, got ${token.block.length} at line ${lineIndex}`);
                }
                return parseValue(build, instructions, new Cursor(token.block[0]), lineIndex);
            }
            else if(token.value === '{}') {
                return parseStruct(build, instructions, new Cursor(token.block), lineIndex)
            }
            else if(token.value === '[]') {
                return parseArray(build, instructions, new Cursor(token.block), lineIndex);
            }
            else {
                throw new Error(`Unknown block type: ${token.value} at line ${lineIndex}`);
            }
        }
        else {
            throw new Error(`Unknown type: ${token.type} at line ${lineIndex}`);
        }
    }
    else {
        const stepResult = parseSteps(build, instructions, cursor, lineIndex);
        if(!stepResult.type) {
            throw new Error(`No type found at line ${lineIndex}`);
        }
        return {
            type: stepResult.type,
            value: stepResult.steps
        };
    }
}

// keywords
function handleFunction(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number, isSync: boolean = false) {

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
    const params = parseParams(build, new Cursor(block), lineIndex);

    // return type
    let returnType: Type | undefined;
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${typeToken.type} at line ${lineIndex}`);
        }
        if(!build.types[typeToken.value]) {
            throw new Error(`Unknown datatype: ${typeToken.value} at line ${lineIndex}`);
        }
        returnType = build.types[typeToken.value];
    }
    else {
        returnType = {
            type: 'primitive',
            primitive: 'unknown'
        };
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
        type: {
            type: 'primitive',
            primitive: 'callable',
        }
    }

    // parse body after function is added to build, so it can be accessed in the body
    const body = toInstructions(bodyToken, build, bodyInstructions, lineIndex, name.value)
    build.functions[name.value].body = body;
}

function handleConst(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number) {

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
    let type: Type | undefined;
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeCursor = cursor.until((token) => token.type === 'symbol' && token.value === '=');
        type = parseType(build, typeCursor, lineIndex);
        cursor.rollback();
    }

    if(cursor.reachedEnd()) {
        throw new Error(`Unexpected end of line at line ${lineIndex}`);
    }
    if(cursor.peek().type !== 'symbol' || cursor.peek().value !== '=') {
        throw new Error(`Expected symbol, got ${cursor.peek().type} at line ${lineIndex}`);
    }
    cursor.next();

    // value
    const valueResult = parseValue(build, instructions, cursor.remaining(), lineIndex);
    if(!type) {
        type = valueResult.type;
    }
    else if(!TypeCheck.matchesValue(build.types, type, valueResult)) {
        throw new Error(`Type mismatch: ${TypeCheck.stringify(type)} !== ${TypeCheck.stringify(valueResult.type)} at line ${lineIndex}`);
    }

    if(!cursor.reachedEnd()) {
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // push to fields
    instructions.fields.local[name.value] = {
        type,
        // TODO: maybe not needed
        reference: valueResult.value.type === 'reference' ? valueResult.value.reference : undefined
    };

    // add to run
    instructions.run.push({
        type: 'const',
        name: name.value,
        value: valueResult.value,
    });
}

function handleVar(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number) {

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
    let type: Type | undefined;
    if(cursor.peek().value === ':') {
        cursor.next();
        const typeToken = cursor.next();
        if(typeToken.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${typeToken.type} at line ${lineIndex}`);
        }
        if(!build.types[typeToken.value]) {
            throw new Error(`Unknown datatype: ${typeToken.value} at line ${lineIndex}`);
        }
        type = build.types[typeToken.value];
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

    // TODO: make this a function
}

function handleSync(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number) {

    // check if sync function
    if(cursor.peek().type === 'keyword' && cursor.peek().value === 'func') {
        handleFunction(build, instructions, cursor, lineIndex, true);
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

function handleReturn(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number, functionName?: string) {

    if(!functionName) {
        throw new Error(`Unexpected return at line ${lineIndex}`);
    }

    const parentFunction = build.functions[functionName];
    if(!parentFunction) {
        throw new Error(`Unknown function: ${functionName} at line ${lineIndex}`);
    }

    if(cursor.remainingLength() === 1) {
        // return type is void
        // add to run
        instructions.run.push({
            type: 'return',
            value: undefined,
        })
        return;
    }

    // value
    const valueToken: Token = cursor.next();
    let value: Value = {
        type: 'primitive',
        primitive: valueToken.value
    };

    let type: Type | undefined;

    if(cursor.reachedEnd()) {
        if(valueToken.type === 'identifier') {
            // check if value is a field
            const resolvedField = FieldResolve.resolve(instructions.fields, valueToken.value, build.functions)
            if(resolvedField === undefined) {
                throw new Error(`Unknown field: ${valueToken.value} at line ${lineIndex}`);
            }
            value = {
                type: 'reference',
                reference: valueToken.value
            }
        }
        else if(valueToken.type === 'datatype') {
            if(!valueToken.specificType) {
                throw new Error(`Expected datatype, got ${valueToken.type} at line ${lineIndex}`);
            }
            type = {
                type: 'primitive',
                primitive: valueToken.specificType
            }
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
    }

    if(!type) {
        throw new Error(`No type specified at line ${lineIndex}`);
    }

    // dynamic type
    if(TypeCheck.matchesPrimitive(build.types, parentFunction.returnType, 'unknown')) {
        // set type
        // TODO: check if setting returnType of parentFunction is enough
        build.functions[functionName].returnType = type;
    }
    // check if return type of function matches
    else if(type !== parentFunction.returnType) {
        throw new Error(`Expected return type ${parentFunction.returnType}, got ${type} at line ${lineIndex}`);
    }

    if(!cursor.reachedEnd()) {
        throw new Error(`Expected end of line, got ${cursor.peek().type} at line ${lineIndex}`);
    }

    // add to run
    instructions.run.push({
        type: 'return',
        value,        
    });
}

function handleType(build: Build, instructions: Instructions, cursor: Cursor<Token>, lineIndex: number) {

    // name
    const nameToken = cursor.next();
    if(nameToken.type !== 'identifier') {
        throw new Error(`Expected identifier, got ${nameToken.type} at line ${lineIndex}`);
    }
    const name = nameToken.value;

    // check if type already exists
    if(build.types[name]) {
        throw new Error(`Type already exists: ${name} at line ${lineIndex}`);
    }

    // check if type is a field
    if(FieldResolve.resolve(instructions.fields, name, build.functions)) {
        throw new Error(`Field already exists: ${name} at line ${lineIndex}`);
    }

    // =
    const equalsToken = cursor.next();
    if(equalsToken.type !== 'symbol' || equalsToken.value !== '=') {
        throw new Error(`Expected '=', got ${equalsToken.type} at line ${lineIndex}`);
    }

    // type
    const type = parseType(build, cursor.remaining(), lineIndex);

    // add to types
    build.types[name] = type;
}