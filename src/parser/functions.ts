import { Context, Param, Statement, Token, Type, Wrappers, ValueNode, Callable, ArrowFunctionValue, ParserScope, ReplaceRefWithGlobalScope, CallableType, UnknownType, VoidType, PointerType, StringType, BooleanType } from "../types"
import Cursor from "../util/cursor"
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

export function createCallable(context: Context, name: string, uniqueName: string, params: Param[], returnType: Type | undefined, bodyToken: Token) {

    // // create proxy scope
    const proxyScope = new ReplaceRefWithGlobalScope(context.scope)
    // create scope
    const funcParentScope = new ParserScope({
        parent: proxyScope,
    })
    const scope = new ParserScope({
        parent: funcParentScope,
    })
    params.forEach(param => {
        scope.set(param.name, {
            type: param.type,
        })
    })

    // add field
    const functionType = new CallableType(params.map(param => param.type), new UnknownType())
    context.scope.set(name, {
        type: functionType,
        preferredName: uniqueName,
    })

    // add self to parent of body scope
    funcParentScope.set(name, {
        type: functionType,
        preferredName: uniqueName,
    })

    // create new wrappers
    const newWrappers: Wrappers = {
        current: {
            returnable: true,
            returnableField: context.scope.getLocal(name)
        },
    }

    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Expected {}, got ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    const body = parseEnvironment(context.build, context.values, bodyToken.block, newWrappers, context.moduleManager, scope)

    // // create global vars for collected
    for(const { globalRef, type }  of proxyScope.collected) {
        context.build.globals[globalRef] = {
            type,
        }
    }

    // check if body has return
    const func = context.scope.getLocal(name)!.type
    if(!(func instanceof CallableType)) {
        throw new Error(`Unexpected type ${func} at ${line(bodyToken)}`)
    }

    if(func.returnType instanceof UnknownType) {
        if(returnType) throw new Error(`Return Types ${returnType} and void do not match at ${line(bodyToken)}`)
        // will return void
        func.returnType = new VoidType()
    }
    else if(returnType && !func.returnType.matches(returnType)) {
        throw new Error(`Types ${func.returnType} and ${returnType} do not match at ${line(bodyToken)}`)
    }
    else if(!returnType && !func.returnType) {
        throw new Error(`No return type found at ${line(bodyToken)}`)
    }

    // update function type if function can throw exception
    if(func.canThrowException) {
        functionType.canThrowException = true
    }

    // add function to build
    const callable: Callable = {
        name: uniqueName,
        body: body.tree,
        params,
        returnType: func.returnType,
        canThrowException: functionType.canThrowException,
    }

    context.build.callables[uniqueName] = callable
    
    return {
        functionType,
        outsideOfScopeAccesses: proxyScope.collected,
    } 
}

export function parseFunc({ context, cursor, wrappers }: { context: Context; cursor: Cursor<Token>; isSync?: boolean; wrappers: Wrappers; }): { statement: Statement, type: Type } {

    // name
    const name = cursor.next()
    if(name.type !== 'identifier') {
        throw new Error(`Unexpected token ${name.type} ${name.value} at ${line(name)}`)
    }

    const scopeUniqueName = `${name.value}_${context.scope.id}`
    // check if field exists
    const searchedField = context.scope.getLocal(name.value)
    if(searchedField) {
        throw new Error(`Field ${name} already exists at ${line(name)}`)
    }
    // check if callable exists
    if(context.build.callables[scopeUniqueName]) {
        throw new Error(`Callable ${scopeUniqueName} already exists at ${line(name)}`)
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

    const created = createCallable(context, name.value, scopeUniqueName, params, returnType, bodyToken)

    return {
        type: created.functionType,
        statement: {
            type: 'functionDeclaration',
            outsideOfScopeAccesses: created.outsideOfScopeAccesses,
        }
    }
}

export function parseReturn(context: Context, cursor: Cursor<Token>, wrappers: Wrappers): Statement {
    
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
    if(!(func instanceof CallableType)) {
        throw new Error(`Unexpected type ${field.type} at ${line(cursor.peekLast())}`)
    }

    if(cursor.done) {
        // return void
        // check if types match
        if(func instanceof UnknownType) {
            // dynamic type
            func.returnType = new VoidType()
        }
        else if(!func.returnType.matches(new VoidType())) {
            throw new Error(`Types ${func.returnType} and void do not match at ${line(cursor.peekLast())}`)
        }
        return {
            type: 'returnStatement',
        }
    }

    // value
    const valueToken = cursor.peek()
    const valueNode = context.values.parseValue(context, cursor.remaining(), wrappers)
    const value = valueNode.value

    // check if types match
    if(func.returnType instanceof UnknownType) {
        // dynamic type
        func.returnType = valueNode.type
    }
    else if(!func.returnType.matches(valueNode.type)) {
        throw new Error(`Types ${func.returnType} and ${valueNode.type} do not match at ${line(valueToken)}`)
    }
    
    return {
        type: 'returnStatement',
        value,
    }
}

export function parseThrowStatement(context: Context, cursor: Cursor<Token>, wrappers: Wrappers): Statement {
    
    // check if returnable
    if(!WrapperResolve.is(wrappers, 'returnable')) {
        throw new Error(`Unexpected throw at ${line(cursor.peekLast())}`)
    }

    // check if function exists
    const field = WrapperResolve.resolveReturnableField(wrappers)
    if(!field) {
        throw new Error(`No function found at ${line(cursor.peekLast())}`)
    }
    const func = field.type
    if(!(func instanceof CallableType)) {
        throw new Error(`Unexpected type ${field.type} at ${line(cursor.peekLast())}`)
    }

    if(cursor.done) throw new Error(`Unexpected end of line at ${line(cursor.peekLast())}`)

    // error message
    const value = context.values.parseValue(context, cursor.remaining(), wrappers)

    // value has to be string
    if(!(value.type instanceof StringType)) {
        throw new Error(`Expected string, got ${value.type} at ${line(cursor.peek())}`)
    }

    // set canThrowException to true
    func.canThrowException = true

    return {
        type: 'throwStatement',
        value: value.value,
    }
}

export function parseArrowFunction(context: Context, leftCursor: Cursor<Token>, rightCursor: Cursor<Token>): ValueNode {
    
    const paramBlock = leftCursor.next()
    if(paramBlock.type !== 'block' || paramBlock.value !== '()') {
        throw new Error(`Expected (), got ${paramBlock.type} ${paramBlock.value} at ${line(paramBlock)}`)
    }
    if(!paramBlock.block) throw new Error(`Unexpected end of line at ${line(paramBlock)}`)
    const params = parseParams(context, new Cursor(paramBlock.block))
        
    let returnType: Type | undefined

    if(!leftCursor.done) {
        const colon = leftCursor.next()
        if(colon.type !== 'symbol' || colon.value !== ':') {
            throw new Error(`Expected :, got ${colon.type} ${colon.value} at ${line(colon)}`)
        }
        returnType = parseType(context, leftCursor.remaining())
    }

    const bodyBlock = rightCursor.next()

    const anonName = `_anonymous${randomUUID()}`

    const created = createCallable(context, anonName, anonName, params, returnType, bodyBlock)

    return {
        type: new PointerType(created.functionType),
        value: new ArrowFunctionValue(anonName, created.outsideOfScopeAccesses)
    }
}