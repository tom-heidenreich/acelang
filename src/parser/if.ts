import { IfStatement, Context, Statement, Token, Wrappers, ParserScope, BooleanType } from "../types";
import Cursor from "../util/cursor";
import line from "../util/LineStringify";
import { parseEnvironment } from "./env";

export function parseIfStatement(context: Context, cursors: Cursor<Cursor<Token>>, wrappers?: Wrappers): IfStatement {

    // if statement
    const cursor = cursors.next()
    
    const condition = cursor.next()
    if(condition.type !== 'block' || condition.value !== '()') {
        throw new Error(`Unexpected token ${condition.type} ${condition.value} at ${line(condition)}`)
    }
    else if(!condition.block) throw new Error(`Unexpected end of line at ${line(condition)}`)
    else if(condition.block.length === 0) throw new Error(`Unexpected end of line at ${line(condition)}`)
    else if(condition.block.length > 1) {
        throw new Error(`Unexpected token ${condition.block[1][0].type} ${condition.block[1][0].value} at ${line(condition)}`)
    }
    const conditionValue = context.values.parseValue(context, new Cursor(condition.block[0]))
    if(!conditionValue.type.matches(new BooleanType())) {
        throw new Error(`Expected boolean value at ${line(condition)}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    // create new scope
    const scope = new ParserScope({
        parent: context.scope,
    })

    // create new wrappers
    const newWrappers = {
        current: {
            breakable: true,
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(context.build, context.values, bodyToken.block, context.moduleManager, scope, newWrappers)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(bodyToken)}`)

    // parse else
    const elseIf: IfStatement[] = []
    let elseStatement: Statement[] | undefined
    while(!cursors.done) {
        const next = cursors.next()
        const peek = next.peek(1)
        if(peek.type === 'keyword' && peek.value === 'if') elseIf.push(parseElseIfStatement(context, next))
        else {
            elseStatement = parseElseStatement(context, next)
            break
        }
    }

    return {
        type: 'ifStatement',
        condition: conditionValue.value,
        body: body.tree,
        elseIf,
        else: elseStatement,
    }
}

function parseElseIfStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): IfStatement {
    
    const keyword = cursor.next()
    if(keyword.type !== 'keyword' || keyword.value !== 'else') {
        throw new Error(`Unexpected token ${keyword.type} ${keyword.value} at ${line(keyword)}`)
    }

    const ifKeyword = cursor.next()
    if(ifKeyword.type !== 'keyword' || ifKeyword.value !== 'if') {
        throw new Error(`Unexpected token ${ifKeyword.type} ${ifKeyword.value} at ${line(ifKeyword)}`)
    }
    
    return parseIfStatement(context, new Cursor([cursor]), wrappers)
}

function parseElseStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement[] {

    const keyword = cursor.next()
    if(keyword.type !== 'keyword' || keyword.value !== 'else') {
        throw new Error(`Unexpected token ${keyword.type} ${keyword.value} at ${line(keyword)}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    // create new scope
    const scope = new ParserScope({
        parent: context.scope,
    })

    // create new wrappers
    const newWrappers = {
        current: {
            breakable: true,
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(context.build, context.values, bodyToken.block, context.moduleManager, scope, newWrappers)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(bodyToken)}`)

    return body.tree
}