import { Fields, LineState, Param, Statement, Token, Type, Wrappers } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import TypeCheck from "../util/TypeCheck";
import Values from "./values";
import { parseEnvironment } from "./env";
import { parseType } from "./types";
import WrapperResolve from "../util/WrapperResolve";

export function parseParams(lineState: LineState, cursor: Cursor<Token[]>) {

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

export function parseFunc({ lineState, cursor, isSync = false, wrappers }: { lineState: LineState; cursor: Cursor<Token>; isSync?: boolean; wrappers?: Wrappers; }): Statement {

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
        }
    }

    // add field
    lineState.env.fields.local[name.value] = {
        type: {
            type: 'callable',
            params: params.map(param => param.type),
            returnType: {
                type: 'primitive',
                primitive: 'unknown',
            },
        }
    }

    // create new wrappers
    const newWrappers: Wrappers = {
        current: {
            returnable: true,
            returnableField: lineState.env.fields.local[name.value]
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(lineState.build, bodyToken.block, env, newWrappers)

    // check if body has return
    const func = lineState.env.fields.local[name.value].type
    if(func.type !== 'callable') {
        throw new Error(`Unexpected type ${func.type} at line ${lineState.lineIndex}`)
    }

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

    // add function to build
    lineState.build.callables[name.value] = {
        body: body.tree,
        isSync,
    }

    return {
        type: 'functionDeclaration',
        name: name.value,
        params,
        returnType: func.returnType,
        body: body.tree,
    }
}

export function parseReturn(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {

    if(!wrappers) {
        throw new Error(`Unexpected return at line ${lineState.lineIndex}`)
    }
    
    // check if returnable
    if(!WrapperResolve.is(wrappers, 'returnable')) {
        throw new Error(`Unexpected return at line ${lineState.lineIndex}`)
    }

    // check if function exists
    const field = WrapperResolve.resolveReturnableField(wrappers)
    if(!field) {
        throw new Error(`No function found at line ${lineState.lineIndex}`)
    }
    const func = field.type
    if(func.type !== 'callable') {
        throw new Error(`Unexpected type ${field.type.type} at line ${lineState.lineIndex}`)
    }

    // value
    const valueToken = Values.parseValue(lineState, cursor)
    const value = valueToken.value

    // check if types match
    if(func.returnType.type === 'primitive' && func.returnType.primitive === 'unknown') {
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