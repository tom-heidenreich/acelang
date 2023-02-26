import { LineState, Statement, Token, Wrappers } from "../types";
import Cursor from "../util/cursor";
import WrapperResolve from "../util/WrapperResolve";

export function parseBreakStatement(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(!WrapperResolve.is(wrappers, 'breakable')) {
        throw new Error(`Unexpected break at line ${lineState.lineIndex}`)
    }
    if(!cursor.done) {
        throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)
    }
    return {
        type: 'breakStatement',
    }
}