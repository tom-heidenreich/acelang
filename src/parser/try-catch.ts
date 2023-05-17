import { parseStatements } from "../compiler/compiler";
import { Scope } from "../compiler/compiler";
import LLVMModule from "../compiler/llvm-module";
import { Context, ParserScope, Statement, Token, Wrappers } from "../types";
import line from "../util/LineStringify";
import Cursor from "../util/cursor";
import { parseEnvironment } from "./env";

export function parseTryStatement(context: Context, cursors: Cursor<Cursor<Token>>, wrappers: Wrappers): Statement {

    // try statement
    const cursor = cursors.next()

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(bodyToken)}`)
    
    if(cursors.done) throw new Error(`Excepted catch statement at ${line(bodyToken)}`)
    const catchStatemens = parseCatchStatement(context, cursors.next(), wrappers)

    // TODO: add support for multiple catch statements
    if(!cursors.done) throw new Error(`Currently only one catch statement is supported`)
    
    // create new wrappers
    const newWrappers = {
        current: {
            handlesException: true,
        },
        parent: wrappers,
    }

    // create new scope
    const scope = new ParserScope({
        parent: context.scope,
    })

    // parse body
    const { tree } = parseEnvironment(context.build, context.values, bodyToken.block, newWrappers, context.moduleManager, scope)

    return {
        type: 'tryStatement',
        body: tree,
        catch: catchStatemens
    }
}

function parseCatchStatement(context: Context, cursor: Cursor<Token>, wrappers: Wrappers) {

    const catchToken = cursor.next()
    if(catchToken.type !== 'keyword' || catchToken.value !== 'catch') {
        throw new Error(`Unexpected token ${catchToken.type} ${catchToken.value} at ${line(catchToken)}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(bodyToken)}`)

    // create new wrappers
    const newWrappers = {
        current: {},
        parent: wrappers,
    }

    // create new scope
    const scope = new ParserScope({
        parent: context.scope,
    })

    // parse body
    const { tree } = parseEnvironment(context.build, context.values, bodyToken.block, newWrappers, context.moduleManager, scope)

    return tree
}