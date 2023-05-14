import { Build, ClassStatement, Context, Modifiers, ParserScope, Statement, Token, Type, Wrappers } from "../types"
import Cursor from "../util/cursor"
import ExpressionParser from "../util/ExpressionParser"
import { parseBreakStatement } from "./break"
import { parseContinueStatement } from "./continue"
import { parseForStatement } from "./for"
import { parseFunc, parseReturn, parseThrowStatement } from "./functions"
import { parseIfStatement } from "./if"
import { parseTypeStatement } from "./types"
import { parseConst, parseVar } from "./vars"
import { parseWhileStatement } from "./while"
// import { parseClassAttribute, parseClassConstructor, parseClassFunc, parseClassStatement } from "./class"
import { parseExportStatement } from "./export"
import { parseImportStatement } from "./import"
import { ModuleManager } from "../modules"
import line from "../util/LineStringify"
import Values from "../values"

let isIfElseChain = false
const ifElseChain: Cursor<Token>[] = []

export function parseEnvironment(build: Build, values: Values, tokens: Token[][], moduleManager?: ModuleManager, preScope?: ParserScope, wrappers?: Wrappers) {

    const scope = preScope || new ParserScope({ isRoot: true })

    const tree: Statement[] = []
    const typeModule: { [key: string]: Type } = {}

    const context: Context = {
        build,
        moduleManager,
        scope,
        values,
    }
    for (const line of tokens) {
        const cursor = new Cursor(line)
        if(cursor.done) continue
        const statement = parseLine({ context, cursor, wrappers })
        if(statement) {
            if(statement.type === 'exportStatement' && statement.exportType) {
                typeModule[statement.name] = statement.exportType
                statement.exportType = undefined
            }
            tree.push(statement)
        }
    }
    if(isIfElseChain) {
        isIfElseChain = false
        tree.push(parseIfStatement(context, new Cursor(ifElseChain), wrappers))
        ifElseChain.length = 0
    }

    return { tree, typeModule }
}

function parseLine({ context, cursor, wrappers }: { context: Context; cursor: Cursor<Token>; wrappers?: Wrappers; }): Statement | void {

    const token = cursor.peek()

    if(isIfElseChain) {
        if(token.type === 'keyword' && token.value === 'else') {
            ifElseChain.push(cursor)
            return
        }
        else {
            isIfElseChain = false
            const ifStatement = parseIfStatement(context, new Cursor(ifElseChain), wrappers)
            ifElseChain.length = 0
            const nextStatement = parseLine({ context, cursor, wrappers })
            
            if(nextStatement) {
                return {
                    type: 'multiStatement',
                    statements: [ifStatement, nextStatement]
                }
            }
            else {
                return ifStatement
            }
        }
    }

    if(token.type === 'keyword') {
        cursor.next()
        switch(token.value) {
            case 'const': return parseConst(context, cursor)
            case 'var': return parseVar(context, cursor)
            case 'func': return parseFunc({ context, cursor, wrappers }).statement
            case 'return': return parseReturn(context, cursor, wrappers)
            case 'throw': return parseThrowStatement(context, cursor, wrappers)
            case 'type': return parseTypeStatement(context, cursor)
            case 'if': {
                isIfElseChain = true
                ifElseChain.push(cursor)
                return
            }
            case 'while': return parseWhileStatement(context, cursor, wrappers)
            case 'for': return parseForStatement(context, cursor, wrappers)
            case 'break': return parseBreakStatement(context, cursor, wrappers)
            case 'continue': return parseContinueStatement(context, cursor, wrappers)
            // case 'class': return parseClassStatement(context, cursor)
            case 'export': return parseExportStatement(context, cursor, wrappers)
            case 'import': return parseImportStatement(context, cursor, wrappers)
        }
        throw new Error(`Unexpected token ${token.type} ${token.value} at ${line(token)}`)
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: ExpressionParser.parse(context, cursor).value
    }
}