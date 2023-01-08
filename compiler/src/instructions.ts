import { Build, Token, Environment, DATATYPES, Types, Runnable, ValueResult, Type, Value, StructType, Struct, ArrayValue, Key, Operation, Operator, LineState, Param, Fields, PlusOperation } from "./types";
import AddressManager from "./util/AddressManager";
import Cursor, { WriteCursor } from "./util/cursor";
import FieldResolve from "./util/FieldResolve";
import OperationParser from "./util/OperationParser";
import TypeCheck from "./util/TypeCheck";

export function toBuildInstructions(tokens: Token[][]) {
    const defaultTypes: Types = {}
    for (const type of DATATYPES) {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type,
        }
    }

    const build: Build = {
        types: defaultTypes,
        functions: {},
        main: {
            fields: {
                local: {},
            },
            run: [],
        },
    }

    const addrManager = new AddressManager(4)
    // reserve addresses
    addrManager.reserveAddress(0x0000, 'cache')
    addrManager.reserveAddress(0x0001, 'return')

    build.main = parseEnvironment(build, addrManager, tokens, build.main)

    return build
}

function parseEnvironment(build: Build, addrManager: AddressManager, tokens: Token[][], preEnv?: Environment, wrapperName?: string) {

    const env: Environment = preEnv || {
        fields: {
            local: {},
        },
        run: [],
    }
    const runnables = new WriteCursor<Runnable>()

    let lineIndex = 0
    for (const line of tokens) {
        const lineState: LineState = {
            addrManager,
            build,
            env,
            runnables,
            lineIndex: lineIndex++,
        }
        const cursor = new Cursor(line)
        if(cursor.done) continue
        parseLine(lineState, cursor, wrapperName)
    }

    env.run = runnables.asList()

    return env
}

function parseLine(lineState: LineState, cursor: Cursor<Token>, wrapperName?: string) {

    const token = cursor.peek()
    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc(lineState, cursor)
            case 'return': return parseReturn(lineState, cursor, wrapperName)
        }
    }
    // parse steps
    const steps = parseSteps(lineState, cursor)
    // malloc
    mallocValue(lineState, steps.value)
}

// functions
function parseParams(lineState: LineState, cursor: Cursor<Token[]>) {

    const params: Param[] = [];

    while(!cursor.done) {

        const lineCursor = new Cursor(cursor.next());

        // name
        const paramName = lineCursor.next();
        if(paramName.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramName.type} at line ${lineState.lineIndex}`);
        }

        // type
        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineState.lineIndex}`);
        }
        lineCursor.next();
        const paramType = lineCursor.next();
        if(paramType.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramType.type} at line ${lineState.lineIndex}`);
        }
        if(!lineState.build.types[paramType.value]) {
            throw new Error(`Unknown datatype: ${paramType.value} at line ${lineState.lineIndex}`);
        }

        params.push({
            name: paramName.value,
            type: lineState.build.types[paramType.value],
        });
    }

    return params;
}

function parseArguments(lineState: LineState, cursor: Cursor<Token[]>) {

    const value: ValueResult[] = []

    while(!cursor.done) {
        const valueResult = parseValue(lineState, new Cursor(cursor.next()))
        value.push({
            type: valueResult.type,
            value: valueResult.value,
        });
    }

    return value;
}

// type
function parseStructType(lineState: LineState, cursor: Cursor<Token[]>): StructType {

    const struct: Types = {}

    while(!cursor.done) {
        const lineCursor = new Cursor(cursor.next());

        const key = lineCursor.next();
        if(key.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${key.type} at line ${lineState.lineIndex}`);
        }

        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at line ${lineState.lineIndex}`);
        }
        lineCursor.next();

        const value = parseType(lineState, lineCursor);

        struct[key.value] = value;
    }

    return {
        type: 'struct',
        properties: struct,
    };
}

function parseType(lineState: LineState, cursor: Cursor<Token>): Type {

    let types: Type[] = [];
    const writeCursor = new WriteCursor<Token>([]);

    function push() {
        
        const cursor = new Cursor(writeCursor.asList());
        const name = cursor.next();

        // array type
        if(!cursor.done) {
            const next = cursor.next();
            if(next.type !== 'block' || next.value !== '[]') {
                throw new Error(`Expected block '[]', got ${next.type} at line ${lineState.lineIndex}`);
            }
            if(!next.block) {
                throw new Error(`Expected block, got ${next.type} at line ${lineState.lineIndex}`);
            }
            if(name.type === 'identifier') {
                if(!lineState.build.types[name.value]) {
                    throw new Error(`Unknown datatype: ${name.value} at line ${lineState.lineIndex}`);
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
                    throw new Error(`Expected block, got ${name.type} at line ${lineState.lineIndex}`);
                }
                types.push({
                    type: 'array',
                    items: parseType(lineState, new Cursor(name.block[0]))
                });
            }
            else {
                throw new Error(`Unknown type: ${name.type} at line ${lineState.lineIndex}`);
            }
        }
        else if(name.type === 'block') {
            if(!name.block) {
                throw new Error(`Expected block, got ${name.type} at line ${lineState.lineIndex}`);
            }
            if(name.value === '()') {
                types.push(parseType(lineState, new Cursor(name.block[0])));
            }
            else if(name.value === '{}') {
                // struct type
                types.push(parseStructType(lineState, new Cursor(name.block)));
            }
            else {
                throw new Error(`Unknown block type: ${name.value} at line ${lineState.lineIndex}`);
            }
        }
        else {
            if(name.type === 'identifier') {
                if(!lineState.build.types[name.value]) {
                    throw new Error(`Unknown datatype: ${name.value} at line ${lineState.lineIndex}`);
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

    while(!cursor.done) {
        const next = cursor.next();
        
        if(next.type === 'symbol' && next.value === '|') {
            push();
        }else {
            writeCursor.push(next);
        }
    }
    push();

    if(types.length === 0) {
        throw new Error(`Expected at least one type, got 0 at line ${lineState.lineIndex}`);
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

// value
function parseArray(lineState: LineState, cursor: Cursor<Token[]>): { type: Type, value: ArrayValue } {

    const value: Value[] = []
    let type: Type | undefined;

    while(!cursor.done) {
        
        const valueResult = parseValue(lineState, new Cursor(cursor.next()))
        if(!type) {
            type = valueResult.type;
        }
        else if(!TypeCheck.matchesValue(lineState.build.types, type, valueResult)) {
            throw new Error(`Expected type ${TypeCheck.stringify(type)}, 
            got ${TypeCheck.stringify(valueResult.type)} at line ${lineState.lineIndex}`);
        }
        value.push(valueResult.value);
    }

    if(!type) {
        throw new Error(`Expected at least one value, got 0 at line ${lineState.lineIndex}`);
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

function parseStruct(lineState: LineState, cursor: Cursor<Token[]>): {type: Type, value: Struct} {
    
    const type: StructType = {
        type: 'struct',
        properties: {}
    }
    const value: Struct = {
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

        const {type: propertyType, value: propertyValue} = parseValue(lineState, lineCursor);

        type.properties[key] = propertyType;
        value.properties[key] = propertyValue;
    }

    return {
        type,
        value
    };
}

function parseValue(lineState: LineState, cursor: Cursor<Token>): ValueResult {

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
                    type: 'primitive',
                    primitive: token.value
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
                    reference: token.value
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
        return parseSteps(lineState, cursor);
    }
}

// steps
function parseSteps(lineState: LineState, cursor: Cursor<Token>): ValueResult {
    
    let lastObject: ValueResult | undefined;
    let lastOperator: Operator | undefined;

    while(!cursor.done) {

        const token = cursor.next();
        if(!lastOperator && lastObject) {
            if(token.type !== 'operator') {
                throw new Error(`Expected operator, got ${token.type} at line ${lineState.lineIndex}`);
            }
            lastOperator = token.value as Operator
        }
        else {

            var currentObject: ValueResult | undefined;
            if(token.type === 'identifier') {
                const field = FieldResolve.resolve(lineState.env.fields, token.value);
                if(!field) {
                    throw new Error(`Unknown field: ${token.value} at line ${lineState.lineIndex}`);
                }
                currentObject = {
                    type: field.type,
                    value: {
                        type: 'reference',
                        reference: token.value
                    }
                }
            }
            else if(token.type === 'datatype') {
                if(!token.specificType) {
                    throw new Error(`Unknown datatype: ${token.value} at line ${lineState.lineIndex}`);
                }
                currentObject = {
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
            else if(token.type === 'block') {
                if(!token.block) {
                    throw new Error(`Expected block, got ${token.type} at line ${lineState.lineIndex}`);
                }
                if(token.value === '()') {
                    if(token.block.length !== 1) {
                        throw new Error(`Expected 1 token in block, got ${token.block.length} at line ${lineState.lineIndex}`);
                    }
                    currentObject = parseValue(lineState, new Cursor(token.block[0]));
                }
                else if(token.value === '{}') {
                    currentObject = parseStruct(lineState, new Cursor(token.block),)
                }
                else if(token.value === '[]') {
                    currentObject = parseArray(lineState, new Cursor(token.block));
                }
                else {
                    throw new Error(`Unknown block type: ${token.value} at line ${lineState.lineIndex}`);
                }
            }
            else {
                throw new Error(`Unknown type: ${token.type} at line ${lineState.lineIndex}`);
            }

            if(!lastObject) {
                lastObject = currentObject;
            }
            else if(lastOperator && currentObject) {
                const operation = OperationParser.parse(lineState, lastObject, currentObject, lastOperator);
                lastObject = {
                    type: operation.type,
                    value: {
                        type: 'operation',
                        operation: operation.value
                    }
                };
                lastOperator = undefined;
            }
            else {
                throw new Error(`Unknown error at line ${lineState.lineIndex}`)
            }
        }
    }

    if(!lastObject) {
        throw new Error(`No object found at line ${lineState.lineIndex}`);
    }

    return lastObject;
}

function valueToBuffer(lineState: LineState, value: Value) {
    if(value.type === 'primitive') {
        // generate binary data
        return Buffer.from(value.primitive.toString(), 'utf8')
    }
    else if(value.type === 'array') {
        // generate addresses for array
        const addresses = value.items.map(value => mallocValue(lineState, value))
        // generate binary data
        return Buffer.from(addresses.join(''), 'utf8')
    }
    else if(value.type === 'struct') {
        // generate addresses for struct
        const buffer: string[] = []
        for (const key in value.properties) {
            const address = mallocValue(lineState, value.properties[key])
            buffer.push(key)
            buffer.push(':')
            buffer.push(address)
        }
        // generate binary data
        return Buffer.from(buffer.join(''), 'utf8')
    }
}

/**
 * Malloc Value
 * @param lineState State of the line
 * @param value Value to malloc
 * @returns Address of the object
 */
function mallocValue(lineState: LineState, value: Value): string {
    // check if reference
    if(value.type === 'reference') {

        // check if field exists (should always exist)
        const reference = FieldResolve.resolve(lineState.env.fields, value.reference)
        if(!reference) {
            throw new Error(`Field ${value.reference} does not exist at line ${lineState.lineIndex}`)
        }
        if(!reference.address) {
            throw new Error(`Field ${value.reference} does not have an address at line ${lineState.lineIndex}`)
        }
        
        return reference.address
    }
    // malloc value
    else if(value.type !== 'operation') {

        // generate address
        const address = lineState.addrManager.address
        let binary = valueToBuffer(lineState, value)

        if(!binary) {
            throw new Error(`No data to malloc at line ${lineState.lineIndex}`)
        }      

        // malloc
        lineState.runnables.push({
            type: 'malloc',
            address,
            size: binary.length,
        })
        // assign
        lineState.runnables.push({
            type: 'assign',
            address,
            data: Uint8Array.from(binary),
            debug: binary.toString('utf8')
        })

        return address
    }
    else if(value.type === 'operation') {
        return mallocOperation(lineState, value.operation)
    }
    else {
        throw new Error(`Unexpected error at line ${lineState.lineIndex}`)
    }
}

function plusOperationWrapper(lineState: LineState, operation: PlusOperation, type: 'add' | 'append') {
    const left = mallocValue(lineState, operation.left)  
    if(operation.right.type !== 'reference') {
        // assign right to cache
        const right = valueToBuffer(lineState, operation.right)
        if(!right) {
            throw new Error(`No data to assign at line ${lineState.lineIndex}`)
        }

        lineState.runnables.push({
            type: 'critical',
            runnables: [
                {
                    type: 'assign',
                    address: lineState.addrManager.getReserved('cache'),
                    data: right,
                    debug: right.toString('utf8')
                },
                {
                    type,
                    address: left,
                    from: lineState.addrManager.getReserved('cache')
                }
            ]
        })
    }
    else {
        // get field
        const field = FieldResolve.resolve(lineState.env.fields, operation.right.reference)
        if(!field) {
            throw new Error(`Field ${operation.right.reference} does not exist at line ${lineState.lineIndex}`)
        }
        if(!field.address) {
            throw new Error(`Field ${operation.right.reference} does not have an address at line ${lineState.lineIndex}`)
        }

        lineState.runnables.push({
            type,
            address: left,
            from: field.address
        })
    }

    return left
}

function mallocOperation(lineState: LineState, operation: Operation): string {
    switch(operation.type) {
        // TODO: will assign to address even if not allowed
        case 'intAdd': {
            return plusOperationWrapper(lineState, operation, 'add')
        }
        // TODO: floatAdd
        case 'stringConcat': {
            return plusOperationWrapper(lineState, operation, 'append')
        }
        case 'assign': {
            const field = operation.left
            const address = field.address || mallocValue(lineState, operation.right)
            const binary = valueToBuffer(lineState, operation.right)

            if(!binary) {
                throw new Error(`No data to assign at line ${lineState.lineIndex}`)
            }

            lineState.runnables.push({
                type: 'assign',
                address,
                data: Uint8Array.from(binary),
                debug: binary.toString('utf8')
            })

            return address
        }
    }
    throw new Error(`Unexpected error at line ${lineState.lineIndex}`)
}

function parseDeclaration(lineState: LineState, cursor: Cursor<Token>, isConst: boolean = false) {

    // name
    const name = cursor.next()
    if(name.type !== 'identifier') {
        throw new Error(`Unexpected token ${name.type} ${name.value} at line ${lineState.lineIndex}`)
    }
    // check if field exists
    const searchedField = FieldResolve.resolve(lineState.env.fields, name.value)
    if(searchedField) {
        throw new Error(`Field ${name.value} already exists at line ${lineState.lineIndex}`)
    }

    // type
    let type: Type | undefined
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next()
        const typeToken = cursor.until(token => token.type === 'operator' && token.value === '=')
        if(typeToken.remainingLength === 0 && isConst) {
            throw new Error(`Unexpected symbol '=' at line ${lineState.lineIndex}`)
        }
        type = parseType(lineState, typeToken)
    }

    if(!cursor.done) {

        if(cursor.peek().type === 'operator' && cursor.peek().value === '=') {
            cursor.next()
        }

        // value
        const valueToken = parseValue(lineState, cursor)
        const value = valueToken.value

        // dynamic type
        if(!type) {
            type = valueToken.type
        }
        // check if types match
        else if(!TypeCheck.matches(lineState.build.types, type, valueToken.type)) {
            throw new Error(`Types ${TypeCheck.stringify(type)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
        }

        // malloc value
        const address = mallocValue(lineState, value)

        // add field
        lineState.env.fields.local[name.value] = {
            type,
            address,
        }
    }
    else if(!isConst){

        // check if type exists
        if(!type) {
            throw new Error(`No type found at line ${lineState.lineIndex}`)
        }

        // add field
        lineState.env.fields.local[name.value] = {
            type,
        }
    }
    else {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }
}

function parseConst(lineState: LineState, cursor: Cursor<Token>) {
    parseDeclaration(lineState, cursor, true)
}

function parseVar(lineState: LineState, cursor: Cursor<Token>) {
    parseDeclaration(lineState, cursor, false)
}

function parseFunc(lineState: LineState, cursor: Cursor<Token>, isSync: boolean = false) {

    // name
    const name = cursor.next()
    if(name.type !== 'identifier') {
        throw new Error(`Unexpected token ${name.type} ${name.value} at line ${lineState.lineIndex}`)
    }
    // check if field exists
    const searchedField = FieldResolve.resolve(lineState.env.fields, name.value)
    if(searchedField) {
        throw new Error(`Field ${name.value} already exists at line ${lineState.lineIndex}`)
    }

    // params
    const paramsToken = cursor.next()
    if(paramsToken.type !== 'block' || paramsToken.value !== '()') {
        throw new Error(`Unexpected token ${paramsToken.type} ${paramsToken.value} at line ${lineState.lineIndex}`)
    }
    if(!paramsToken.block) {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }
    const params = parseParams(lineState, new Cursor(paramsToken.block))
    // convert to fields
    const paramFields = params.reduce((fields, param) => {
        fields[param.name] = {
            type: param.type,
            // generate address
            address: lineState.addrManager.address
        }
        return fields
    }, {} as Fields)

    // return type
    let returnType: Type | undefined
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next()
        const typeToken = cursor.until(token => token.type === 'block' && token.value === '{}')
        if(typeToken.remainingLength === 0) {
            throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
        }
        returnType = parseType(lineState, typeToken)
    }

    // body
    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    if(!bodyToken.block) {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }

    // create new env
    const env = {
        fields: {
            local: paramFields,
            parent: lineState.env.fields,
        },
        run: []
    }

    // add function to build
    lineState.build.functions[name.value] = {
        params,
        returnType: {
            type: 'primitive',
            primitive: 'unknown',
        },
        body: env,
        isSync,
    }

    // add field
    lineState.env.fields.local[name.value] = {
        type: {
            type: 'primitive',
            primitive: 'callable',
        }
    }

    // parse body
    const body = parseEnvironment(lineState.build, lineState.addrManager, bodyToken.block, env, name.value)

    // check if body has return
    const func = lineState.build.functions[name.value]
    if(func.returnType.type === 'primitive' && func.returnType.primitive === 'unknown') {
        // will return void
        func.returnType = {
            type: 'primitive',
            primitive: 'void',
        }
    }
    else if(returnType && !TypeCheck.matches(lineState.build.types, func.returnType, returnType)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(returnType)} do not match at line ${lineState.lineIndex}`)
    }
    else if(!returnType && !func.returnType) {
        throw new Error(`No return type found at line ${lineState.lineIndex}`)
    }

    // add body
    func.body = body
}

function parseReturn(lineState: LineState, cursor: Cursor<Token>, wrapperName?: string) {

    if(!wrapperName) {
        throw new Error(`Unexpected return at line ${lineState.lineIndex}`)
    }

    // check if function exists
    const field = FieldResolve.resolve(lineState.env.fields, wrapperName)
    if(!field) {
        throw new Error(`No function found at line ${lineState.lineIndex}`)
    }
    // check if field is callable
    if(!TypeCheck.matchesPrimitive(lineState.build.types, field.type, 'callable')) {
        throw new Error(`Field ${wrapperName} is not callable at line ${lineState.lineIndex}`)
    }
    // get function
    const func = lineState.build.functions[wrapperName]

    // value
    const valueToken = parseValue(lineState, cursor)
    const value = valueToken.value

    // check if types match
    if(TypeCheck.matchesPrimitive(lineState.build.types, func.returnType, 'unknown')) {
        // dynamic type
        func.returnType = valueToken.type
    }
    else if(!TypeCheck.matches(lineState.build.types, func.returnType, valueToken.type)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
    }

    // malloc value
    const address = mallocValue(lineState, value)

    // add return and free
    lineState.runnables.push({
        type: 'critical',
        runnables: [
            {
                type: 'move',
                from: address,
                to: lineState.addrManager.getReserved('return'),
            },
            {
                type: 'free',
                address,
            },
        ]
    })
}