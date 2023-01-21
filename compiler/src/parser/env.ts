import { Build, Environment, LineState, Statement, Token, Wrappers } from "../types"
import Cursor from "../util/cursor"
import ExpressionParser from "../util/ExpressionParser"
import { parseBreakStatement } from "./break"
import { parseContinueStatement } from "./continue"
import { parseFunc, parseReturn } from "./functions"
import { parseIfStatement } from "./if"
import { parseSync } from "./sync"
import { parseTypeStatement } from "./types"
import { parseConst, parseVar } from "./vars"
import { parseWhileStatement } from "./while"

let isIfElseChain = false
const ifElseChain: Cursor<Token>[] = []

export function parseEnvironment(build: Build, tokens: Token[][], preEnv?: Environment, wrappers?: Wrappers) {

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
        const statement = parseLine({ lineState, cursor, wrappers, pushBefore: statement => {
            tree.push(statement)
        }})
        if(statement) tree.push(statement)
    }
    if(isIfElseChain) {
        isIfElseChain = false
        tree.push(parseIfStatement({ build, env, lineIndex: lineIndex++ }, new Cursor(ifElseChain), wrappers))
        ifElseChain.length = 0
    }

    return { tree, env }
}

function parseLine({ lineState, cursor, wrappers, pushBefore }: { lineState: LineState; cursor: Cursor<Token>; wrappers?: Wrappers; pushBefore: (statement: Statement) => void }): Statement | void {

    const token = cursor.peek()

    if(isIfElseChain) {
        if(token.type === 'keyword' && token.value === 'else') {
            ifElseChain.push(cursor)
            return
        }
        else {
            isIfElseChain = false
            pushBefore(parseIfStatement(lineState, new Cursor(ifElseChain), wrappers))
            ifElseChain.length = 0
        }
    }

    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc({ lineState, cursor, wrappers })
            case 'return': return parseReturn(lineState, cursor, wrappers)
            case 'sync': return parseSync(lineState, cursor)
            case 'type': return parseTypeStatement(lineState, cursor)
            case 'if': {
                isIfElseChain = true
                ifElseChain.push(cursor)
                return
            }
            case 'else': throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
            case 'while': return parseWhileStatement(lineState, cursor, wrappers)
            case 'break': return parseBreakStatement(lineState, cursor, wrappers)
            case 'continue': return parseContinueStatement(lineState, cursor, wrappers)
        }
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: ExpressionParser.parse(lineState, cursor).value
    }
}