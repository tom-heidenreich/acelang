import { Build, Environment, LineState, Statement, Token } from "../types"
import Cursor from "../util/cursor"
import ExpressionParser from "../util/ExpressionParser"
import { parseFunc, parseReturn } from "./functions"
import { parseSync } from "./sync"
import { parseTypeStatement } from "./types"
import { parseConst, parseVar } from "./vars"

export function parseEnvironment(build: Build, tokens: Token[][], preEnv?: Environment, wrapperName?: string) {

    const env: Environment = preEnv || {
        fields: {
            local: {},
        },
    }

    const tree: Statement[] = [] 

    let lineIndex = 0
    for (const line of tokens) {
        const lineState: LineState = {
            build,
            env,
            lineIndex: lineIndex++,
        }
        const cursor = new Cursor(line)
        if(cursor.done) continue
        tree.push(parseLine({ lineState, cursor, wrapperName })!)
    }

    return { tree, env }
}

function parseLine({ lineState, cursor, wrapperName }: { lineState: LineState; cursor: Cursor<Token>; wrapperName?: string; }): Statement | void {

    const token = cursor.peek()
    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc(lineState, cursor)
            case 'return': return parseReturn(lineState, cursor, wrapperName)
            case 'sync': return parseSync(lineState, cursor)
            case 'type': return parseTypeStatement(lineState, cursor)
        }
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: ExpressionParser.parse(lineState, cursor).value
    }
}