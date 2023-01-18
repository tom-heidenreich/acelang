import { Token, Environment, DATATYPES, Types, Type, StructType, LineState, Param, Fields, Build, Statement } from "./types";
import Cursor, { WriteCursor } from "./util/cursor";
import FieldResolve from "./util/FieldResolve";
import TypeCheck from "./util/TypeCheck";

import Values from "./util/values";

export function buildAST(tokens: Token[][]) {

    const defaultTypes: Types = {}
    for (const type of DATATYPES) {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type,
        }
    }
    
    const build: Build = {
        types: defaultTypes,
        functions: {
            // built in functions
            print: {
                params: [{
                    name: 'value',
                    type: {
                        type: 'primitive',
                        primitive: 'any',
                    },
                }],
                returnType: {
                    type: 'primitive',
                    primitive: 'void',
                },
                isSync: true,
                body: [],
            },
            wait: {
                params: [
                    {
                        name: 'value',
                        type: {
                            type: 'primitive',
                            primitive: 'int',
                        }
                    }
                ],
                returnType: {
                    type: 'primitive',
                    primitive: 'void',
                },
                isSync: true,
                body: [],
            }
        },
    }

    const { tree, env } = parseEnvironment(build, tokens, {
        fields: {
            local: {},
            parent: {
                local: {
                    print: {
                        type: {
                            type: 'primitive',
                            primitive: 'callable',
                        }
                    },
                    wait: {
                        type: {
                            type: 'primitive',
                            primitive: 'callable',
                        }
                    }
                },
            }
        },
    })

    // clean functions
    const functions: {
        name: string,
        params: Param[],
        returnType: Type,
        isSync: boolean,
    }[] = []
    for (const name in build.functions) {
        const func = build.functions[name]
        functions.push({
            name: name,
            params: func.params,
            returnType: func.returnType,
            isSync: func.isSync,
        })
    }

    return { tree, map: {
        types: build.types,
        fields: env.fields.local,
        functions,
    } }
}

function parseEnvironment(build: Build, tokens: Token[][], preEnv?: Environment, wrapperName?: string) {

    const env: Environment = preEnv || {
        fields: {
            local: {},
        },
    }

    const tree: Statement[] = [] 

    let lineIndex = 0
    for (const line of tokens) {
        const lineState: LineState = {
            build,
            env,
            lineIndex: lineIndex++,
        }
        const cursor = new Cursor(line)
        if(cursor.done) continue
        tree.push(parseLine({ lineState, cursor, wrapperName }))
    }

    return { tree, env }
}

function parseLine({ lineState, cursor, wrapperName }: { lineState: LineState; cursor: Cursor<Token>; wrapperName?: string; }): Statement {

    const token = cursor.peek()
    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc(lineState, cursor)
            case 'return': return parseReturn(lineState, cursor, wrapperName)
            case 'sync': return parseSync(lineState, cursor)
        }
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: Values.parseExpression(lineState, cursor).value
    }
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

function parseDeclaration(lineState: LineState, cursor: Cursor<Token>, isConst: boolean = false): Statement {

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
        const valueToken = Values.parseValue(lineState, cursor)
        const value = valueToken.value

        // dynamic type
        if(!type) {
            type = valueToken.type
        }
        // check if types match
        else if(!TypeCheck.matches(lineState.build.types, type, valueToken.type)) {
            throw new Error(`Types ${TypeCheck.stringify(type)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
        }

        // add field
        lineState.env.fields.local[name.value] = {
            type,
        }
        
        if(isConst) return {
            type: 'constantDeclaration',
            name: name.value,
            value,
        }
        else return {
            type: 'variableDeclaration',
            name: name.value,
            value,
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

        return {
            type: 'variableDeclaration',
            name: name.value,
        }
    }
    else {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }
}

function parseConst(lineState: LineState, cursor: Cursor<Token>) {
    return parseDeclaration(lineState, cursor, true)
}

function parseVar(lineState: LineState, cursor: Cursor<Token>) {
    return parseDeclaration(lineState, cursor, false)
}

function parseFunc(lineState: LineState, cursor: Cursor<Token>, isSync: boolean = false): Statement {

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
        body: [],
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
    const body = parseEnvironment(lineState.build, bodyToken.block, env, name.value)

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
    func.body = body.tree

    return {
        type: 'functionDeclaration',
        name: name.value,
        params,
        returnType: func.returnType,
        body: body.tree,
    }
}

function parseReturn(lineState: LineState, cursor: Cursor<Token>, wrapperName?: string): Statement {

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
    const valueToken = Values.parseValue(lineState, cursor)
    const value = valueToken.value

    // check if types match
    if(TypeCheck.matchesPrimitive(lineState.build.types, func.returnType, 'unknown')) {
        // dynamic type
        func.returnType = valueToken.type
    }
    else if(!TypeCheck.matches(lineState.build.types, func.returnType, valueToken.type)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
    }
    
    return {
        type: 'returnStatement',
        value,
    }
}

function parseSync(lineState: LineState, cursor: Cursor<Token>): Statement {

    // check if next token is function
    const token = cursor.next()
    if(token.type === 'keyword' && token.value === 'func') {
        return parseFunc(lineState, cursor, true)
    }

    if(token.type !== 'block' || token.value !== '{}') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
    }

    if(!token.block) {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }

    // create new env
    const env = {
        fields: {
            local: {},
            parent: lineState.env.fields,
        },
        run: []
    }
    
    // parse body
    const body = parseEnvironment(lineState.build, token.block, env)

    return {
        type: 'syncStatement',
        body: body.tree,
    }
}