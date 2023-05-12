import { Context, Param, Statement, Token, Type, Wrappers, ValueNode, Callable, ArrowFunctionValue, ParserScope, AccessProxyScope } from "../types"
import Cursor from "../util/cursor"
import TypeCheck from "../util/TypeCheck";
import { parseEnvironment } from "./env";
import { parseType } from "./types";
import WrapperResolve from "../util/WrapperResolve";
import line from "../util/LineStringify";
import { randomUUID } from "crypto";

export function parseParams(context: Context, cursor: Cursor<Token[]>) {

    const params: Param[] = [];

    while(!cursor.done) {

        const lineCursor = new Cursor(cursor.next());

        // name
        const paramName = lineCursor.next();
        if(paramName.type !== 'identifier') {
            throw new Error(`Expected identifier, got ${paramName.type} at ${line(paramName)}`);
        }

        // type
        if(lineCursor.peek().type !== 'symbol' || lineCursor.peek().value !== ':') {
            throw new Error(`Expected symbol ':', got ${lineCursor.peek().type} at ${line(lineCursor.peek())}`);
        }
        lineCursor.next();
        
        const type = parseType(context, lineCursor.remaining());

        params.push({
            name: paramName.value,
            type,
        });
    }

    return params;
}

export function parseFunc({ context, cursor, wrappers }: { context: Context; cursor: Cursor<Token>; isSync?: boolean; wrappers?: Wrappers; }): { statement: Statement, type: Type } {

    // name
    const name = cursor.next()
    if(name.type !== 'identifier') {
        throw new Error(`Unexpected token ${name.type} ${name.value} at ${line(name)}`)
    }
    // check if field exists
    const searchedField = context.scope.getLocal(name.value)
    if(searchedField) {
        throw new Error(`Field ${name.value} already exists at ${line(name)}`)
    }
    // check if callable exists
    if(context.build.callables[name.value]) {
        throw new Error(`Callable ${name.value} already exists at ${line(name)}`)
    }

    // params
    const paramsToken = cursor.next()
    if(paramsToken.type !== 'block' || paramsToken.value !== '()') {
        throw new Error(`Unexpected token ${paramsToken.type} ${paramsToken.value} at ${line(paramsToken)}`)
    }
    if(!paramsToken.block) {
        throw new Error(`Unexpected end of line at ${line(paramsToken)}`)
    }
    const params = parseParams(context, new Cursor(paramsToken.block))
    
    // create scope
    const scope = new ParserScope({
        global: context.scope.global,
    })
    params.forEach(param => {
        scope.set(param.name, {
            type: param.type,
        })
    })

    // return type
    let returnType: Type | undefined
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        const next = cursor.next()
        const typeToken = cursor.until(token => token.type === 'block' && token.value === '{}')
        if(typeToken.remainingLength === 0) {
            throw new Error(`Unexpected end of line at ${line(next)}`)
        }
        returnType = parseType(context, typeToken)
    }

    // body
    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    if(!bodyToken.block) {
        throw new Error(`Unexpected end of line at ${line(bodyToken)}`)
    }

    // add field
    const functionType: Type = {
        type: 'callable',
        params: params.map(param => param.type),
        returnType: {
            type: 'primitive',
            primitive: 'unknown',
        },
    }
    context.scope.set(name.value, {
        type: functionType,
    })

    // add self to body scope
    scope.set(name.value, {
        type: functionType
    })

    // create new wrappers
    const newWrappers: Wrappers = {
        current: {
            returnable: true,
            returnableField: context.scope.getLocal(name.value)
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(context.build, context.values, bodyToken.block, context.moduleManager, scope, newWrappers)

    // check if body has return
    const func = context.scope.getLocal(name.value)!.type
    if(func.type !== 'callable') {
        throw new Error(`Unexpected type ${func.type} at ${line(bodyToken)}`)
    }

    if(func.returnType.type === 'primitive' && func.returnType.primitive === 'unknown') {
        if(returnType) throw new Error(`Return Types ${TypeCheck.stringify(returnType)} and void do not match at ${line(bodyToken)}`)
        // will return void
        func.returnType = {
            type: 'primitive',
            primitive: 'void',
        }
    }
    else if(returnType && !TypeCheck.matches(context.build.types, func.returnType, returnType)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(returnType)} do not match at ${line(bodyToken)}`)
    }
    else if(!returnType && !func.returnType) {
        throw new Error(`No return type found at ${line(bodyToken)}`)
    }

    // add function to build
    context.build.callables[name.value] = {
        body: body.tree,
        params,
        returnType: func.returnType,
    }

    return {
        type: functionType,
        statement: {
            type: 'functionDeclaration',
            name: name.value,
            params,
            returnType: func.returnType,
            body: body.tree,
        }
    }
}

export function parseReturn(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {

    if(!wrappers) {
        throw new Error(`Unexpected return at ${line(cursor.peekLast())}`)
    }
    
    // check if returnable
    if(!WrapperResolve.is(wrappers, 'returnable')) {
        throw new Error(`Unexpected return at ${line(cursor.peekLast())}`)
    }

    // check if function exists
    const field = WrapperResolve.resolveReturnableField(wrappers)
    if(!field) {
        throw new Error(`No function found at ${line(cursor.peekLast())}`)
    }
    const func = field.type
    if(func.type !== 'callable') {
        throw new Error(`Unexpected type ${field.type.type} at ${line(cursor.peekLast())}`)
    }

    // value
    const valueToken = cursor.peek()
    const valueNode = context.values.parseValue(context, cursor.remaining())
    const value = valueNode.value

    // check if types match
    if(func.returnType.type === 'primitive' && func.returnType.primitive === 'unknown') {
        // dynamic type
        func.returnType = valueNode.type
    }
    else if(!TypeCheck.matches(context.build.types, func.returnType, valueNode.type)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(valueNode.type)} do not match at ${line(valueToken)}`)
    }
    
    return {
        type: 'returnStatement',
        value,
    }
}

export function parseArrowFunction(context: Context, leftCursor: Cursor<Token>, rightCursor: Cursor<Token>): ValueNode {
    
    const paramBlock = leftCursor.next()
    if(paramBlock.type !== 'block' || paramBlock.value !== '()') {
        throw new Error(`Expected (), got ${paramBlock.type} ${paramBlock.value} at ${line(paramBlock)}`)
    }
    if(!paramBlock.block) throw new Error(`Unexpected end of line at ${line(paramBlock)}`)
    const params = parseParams(context, new Cursor(paramBlock.block))
        
    // create proxy scope
    const proxyScope = new AccessProxyScope(context.scope)
    
    // create scope
    const scope = new ParserScope({
        global: context.scope.global,
        parent: proxyScope,
    })
    params.forEach(param => {
        scope.set(param.name, {
            type: param.type,
        })
    })

    let returnType: Type | undefined

    if(!leftCursor.done) {
        const colon = leftCursor.next()
        if(colon.type !== 'symbol' || colon.value !== ':') {
            throw new Error(`Expected :, got ${colon.type} ${colon.value} at ${line(colon)}`)
        }
        returnType = parseType(context, leftCursor.remaining())
    }

    const bodyBlock = rightCursor.next()
    if(bodyBlock.type !== 'block' || bodyBlock.value !== '{}') {
        throw new Error(`Expected {}, got ${bodyBlock.type} ${bodyBlock.value} at ${line(bodyBlock)}`)
    }
    if(!bodyBlock.block) throw new Error(`Unexpected end of line at ${line(bodyBlock)}`)

    // add field
    const functionType: Type = {
        type: 'callable',
        params: params.map(param => param.type),
        returnType: {
            type: 'primitive',
            primitive: 'unknown',
        },
    }
    const anonName = `_anonymous${randomUUID()}`
    context.scope.set(anonName, {
        type: functionType,
    })

    // create new wrappers
    const newWrappers: Wrappers = {
        current: {
            returnable: true,
            returnableField: context.scope.getLocal(anonName)
        }
        // no parent wrappers
    }

    const body = parseEnvironment(context.build, context.values, bodyBlock.block, context.moduleManager, scope, newWrappers)
    
    // create global vars for collected
    for(const { globalRef, type }  of proxyScope.collected) {
        // TODO: don't create a new global if a global that is pointing to the same already exists
        context.build.globals[globalRef] = {
            type,
        }
    }

    // check if body has return
    const func = context.scope.getLocal(anonName)!.type
    if(func.type !== 'callable') {
        throw new Error(`Unexpected type ${func.type} at ${line(bodyBlock)}`)
    }

    if(func.returnType.type === 'primitive' && func.returnType.primitive === 'unknown') {
        // will return void
        func.returnType = {
            type: 'primitive',
            primitive: 'void',
        }
    }
    else if(returnType && !TypeCheck.matches(context.build.types, func.returnType, returnType)) {
        throw new Error(`Types ${TypeCheck.stringify(func.returnType)} and ${TypeCheck.stringify(returnType)} do not match at ${line(bodyBlock)}`)
    }
    else if(!returnType && !func.returnType) {
        throw new Error(`No return type found at ${line(bodyBlock)}`)
    }

    // add function to build
    const callable: Callable = {
        body: body.tree,
        params,
        returnType: func.returnType,
    }

    context.build.callables[anonName] = callable
    return {
        type: {
            type: 'pointer',
            pointer: functionType,
        },
        value: new ArrowFunctionValue(anonName, proxyScope.collected)
    }
}