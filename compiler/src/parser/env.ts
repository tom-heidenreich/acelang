import { Build, Environment, LineState, Statement, Token } from "../types"
import Cursor from "../util/cursor"
import ExpressionParser from "../util/ExpressionParser"
import { parseFunc, parseReturn } from "./functions"
import { parseIfStatement } from "./if"
import { parseSync } from "./sync"
import { parseTypeStatement } from "./types"
import { parseConst, parseVar } from "./vars"

let isIfElseChain = false
const ifElseChain: Cursor<Token>[] = []

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
        tree.push(parseLine({ lineState, cursor, wrapperName, pushBefore: statement => {
            tree.push(statement)
        }})!)
    }
    if(isIfElseChain) {
        isIfElseChain = false
        tree.push(parseIfStatement({ build, env, lineIndex: lineIndex++ }, new Cursor(ifElseChain)))
        ifElseChain.length = 0
    }

    return { tree, env }
}

function parseLine({ lineState, cursor, wrapperName, pushBefore }: { lineState: LineState; cursor: Cursor<Token>; wrapperName?: string; pushBefore: (statement: Statement) => void }): Statement | void {

    const token = cursor.peek()

    if(isIfElseChain) {
        if(token.type === 'keyword' && token.value === 'else') {
            ifElseChain.push(cursor)
            return
        }
        else {
            isIfElseChain = false
            pushBefore(parseIfStatement(lineState, new Cursor(ifElseChain)))
            ifElseChain.length = 0
        }
    }

    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc(lineState, cursor)
            case 'return': return parseReturn(lineState, cursor, wrapperName)
            case 'sync': return parseSync(lineState, cursor)
            case 'type': return parseTypeStatement(lineState, cursor)
            case 'if': {
                isIfElseChain = true
                ifElseChain.push(cursor)
                return
            }
            case 'else': throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
        }
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: ExpressionParser.parse(lineState, cursor).value
    }
}