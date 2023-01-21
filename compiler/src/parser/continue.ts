import { LineState, Statement, Token, Wrappers } from "../types";
import Cursor from "../util/cursor";
import WrapperResolve from "../util/WrapperResolve";

export function parseContinueStatement(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(!WrapperResolve.is(wrappers, 'continuable')) {
        throw new Error(`Unexpected continue at line ${lineState.lineIndex}`)
    }
    if(!cursor.done) {
        throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)
    }
    return {
        type: 'continueStatement',
    }
}