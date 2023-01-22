import { ClassStatement, Field, Fields, FunctionDeclaration, LineState, Modifiers, Statement, Token, Type, VariableDeclaration, Wrappers } from "../types";
import Cursor from "../util/cursor";
import { parseClassEnv, parseEnvironment } from "./env";
import { parseFunc, parseParams } from "./functions";
import { parseDeclaration } from "./vars";

export function parseClassStatement(lineState: LineState, cursor: Cursor<Token>): Statement {

    // get class name
    const nameToken = cursor.next()
    if(nameToken.type !== 'identifier') {
        throw new Error(`Unexpected token ${nameToken.type} ${nameToken.value} at line ${lineState.lineIndex}`)
    }
    const name = nameToken.value

    // get class body
    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    
    // create new type
    const thisType: Type = {
        type: 'primitive',
        primitive: 'any',
    }
    lineState.build.types[name] = thisType

    // create new env
    const env = {
        fields: {
            local: {
                this: {
                    type: thisType,
                }
            },
            parent: lineState.env.fields,
        },
    }
    // create new wrappers
    const newWrappers = {
        current: {
            class: true,
        },
    }

    // parse class body
    let body = parseClassEnv(lineState.build, bodyToken.block, env, newWrappers)

    // create type of class
    const privateClassType: Type = classToPrivateType(body.tree)

    // add type to build
    lineState.build.types[name] = classToType(body.tree)

    // create new env
    const env2 = {
        fields: {
            local: {
                this: {
                    type: privateClassType,
                }
            },
            parent: lineState.env.fields,
        }
    }
    // parse class body TODO: should only check types
    body = parseClassEnv(lineState.build, bodyToken.block, env2, newWrappers)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)

    return {
        type: 'classDeclaration',
        name,
        body: body.tree.map(statement => statement.statement),
    }
}

export function parseClassAttribute(lineState: LineState, cursor: Cursor<Token>, wrappers: Wrappers, modifiers: Modifiers): { statement: ClassStatement, type: Type } {

    // get declaration
    const { statement, type } = parseDeclaration(lineState, cursor, false)
    const declaration = statement as VariableDeclaration

    return {
        type,
        statement: {
            type: 'classAttributeDeclaration',
            name: declaration.name,
            value: declaration.value,
            modifiers,
        }
    }
}

export function parseClassFunc(lineState: LineState, cursor: Cursor<Token>, wrappers: Wrappers, modifiers: Modifiers): { statement: ClassStatement, type: Type } {

    // get declaration
    const { statement, type } = parseFunc({ lineState, cursor, wrappers })
    const declaration = statement as FunctionDeclaration

    return {
        type,
        statement: {
            type: 'classFunctionDeclaration',
            name: declaration.name,
            params: declaration.params,
            returnType: declaration.returnType,
            body: declaration.body,
            modifiers,
        }
    }
}

export function parseClassConstructor(lineState: LineState, cursor: Cursor<Token>, wrappers: Wrappers, modifiers: Modifiers): { statement: ClassStatement, type: Type } {

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
    }

    // parse body
    const body = parseEnvironment(lineState.build, bodyToken.block, env, wrappers)

    return {
        type: {
            type: 'primitive',
            primitive: 'void',
        },
        statement: {
            type: 'classConstructorDeclaration',
            params,
            body: body.tree,
        }
    }
}

function classToType(statements: { statement: ClassStatement, type: Type }[]): Type {

    const struct: {
        [key: string]: Type
    } = {}

    for(const statement of statements) {
        if(statement.statement.type === 'classConstructorDeclaration') continue;
        const modifiers = statement.statement.modifiers
        if(modifiers.access === 'public') {
            struct[statement.statement.name] = statement.type
        }
    }

    return {
        type: 'struct',
        properties: struct,
    }
}

function classToPrivateType(statements: { statement: ClassStatement, type: Type }[]): Type {

    const struct: {
        [key: string]: Type
    } = {}

    for(const statement of statements) {
        if(statement.statement.type === 'classConstructorDeclaration') continue;
        struct[statement.statement.name] = statement.type
    }

    return {
        type: 'struct',
        properties: struct,
    }
}