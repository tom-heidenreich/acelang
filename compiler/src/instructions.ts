import { Build, Token, Environment, DATATYPES, Types, Runnable, ValueResult, Type, Value, StructType, Struct, ArrayValue, Key } from "./types";
import AddressManager from "./util/AddressManager";
import Cursor, { WriteCursor } from "./util/cursor";
import FieldResolve from "./util/FieldResolve";
import TypeCheck from "./util/TypeCheck";

type LineState = {
    addrManager: AddressManager,
    build: Build,
    env: Environment,
    runnables: WriteCursor<Runnable>,
    lineIndex: number,
}

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
        main: {
            fields: {
                local: {},
            },
            run: [],
        },
    }

    build.main = parseEnvironment(build, new AddressManager(), tokens, build.main)

    return build
}

function parseEnvironment(build: Build, addrManager: AddressManager, tokens: Token[][], preEnv?: Environment) {

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
        parseLine(lineState, cursor)
    }

    env.run = runnables.asList()

    return env
}

function parseLine(lineState: LineState, cursor: Cursor<Token>) {
    const token = cursor.next()
    
    if(token.type === 'keyword') {
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
        }
    }
    throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
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
        throw new Error(`Not implemented at line ${lineState.lineIndex}`)
        /*const stepResult = parseSteps(build, instructions, cursor, lineIndex);
        if(!stepResult.type) {
            throw new Error(`No type found at line ${lineIndex}`);
        }
        return {
            type: stepResult.type,
            value: stepResult.value
        };*/
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
        
        return reference.address
    }
    // malloc value
    else if(value.type !== 'steps') {

        // generate address
        const address = lineState.addrManager.address
        let binary: Buffer | undefined

        if(value.type === 'primitive') {
            // generate binary data
            binary = Buffer.from(value.primitive.toString(), 'utf8')
        }
        else if(value.type === 'array') {
            // generate addresses for array
            const addresses = value.items.map(value => mallocValue(lineState, value))
            // generate binary data
            binary = Buffer.from(addresses.join(''), 'utf8')
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
            binary = Buffer.from(buffer.join(''), 'utf8')
        }

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
    else {
        throw new Error(`Not implemented at line ${lineState.lineIndex}`)
    }
}

function parseConst(lineState: LineState, cursor: Cursor<Token>) {

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
        const typeToken = cursor.until(token => token.type === 'symbol' && token.value === '=')
        if(typeToken.remainingLength === 0) {
            throw new Error(`Unexpected symbol '=' at line ${lineState.lineIndex}`)
        }
        type = parseType(lineState, typeToken)
    }
    else if(cursor.peek().type === 'symbol' && cursor.peek().value === '=') {
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