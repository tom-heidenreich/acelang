import { Context, Statement, Token, Wrappers } from "../types";
import Cursor from "../util/cursor";
import line from "../util/LineStringify";
import WrapperResolve from "../util/WrapperResolve";

export function parseBreakStatement(context: Context, cursor: Cursor<Token>, wrappers: Wrappers): Statement {
    if(!WrapperResolve.is(wrappers, 'breakable')) {
        throw new Error(`Unexpected break at ${line(cursor.peekLast())}`)
    }
    if(!cursor.done) {
        throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(cursor.peek())}`)
    }
    return {
        type: 'breakStatement',
    }
}