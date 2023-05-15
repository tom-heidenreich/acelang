import { ArrayType, Context, ParserScope, Statement, Token, Wrappers } from "../types";
import Cursor from "../util/cursor";
import line from "../util/LineStringify";
import { parseEnvironment } from "./env";

export function parseForStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {

    // get identifier
    const identifier = cursor.next()
    if(identifier.type !== 'identifier') throw new Error(`Expected identifier, got ${identifier.type} ${identifier.value}`)

    if(cursor.peek().type !== 'keyword' || cursor.peek().value !== 'of') throw new Error(`Expected keyword of, got ${cursor.peek().type} ${cursor.peek().value}`)
    cursor.next()

    // get iterable
    const iterable = context.values.parseValue(context, new Cursor([cursor.next()]), wrappers)
    if(!(iterable.type instanceof ArrayType)) {
        throw new Error(`Expected array, got ${iterable.type}`)
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
    scope.set(identifier.value, {
        type: iterable.type,
    })

    // create new wrappers
    const newWrappers = {
        current: {
            breakable: true,
            continuable: true,
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(context.build, context.values, bodyToken.block, context.moduleManager, scope, newWrappers)
    
    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(cursor.peek())}`)

    return {
        type: 'forStatement',
        iterable: iterable.value,
        variable: identifier.value,
        body: body.tree,
    }
}