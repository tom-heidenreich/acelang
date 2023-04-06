import { Build, ClassStatement, Environment, LineState, Modifiers, Statement, Token, Type, Wrappers } from "../types"
import Cursor from "../util/cursor"
import ExpressionParser from "../util/ExpressionParser"
import { parseBreakStatement } from "./break"
import { parseContinueStatement } from "./continue"
import { parseForStatement } from "./for"
import { parseFunc, parseReturn } from "./functions"
import { parseIfStatement } from "./if"
import { parseSync } from "./sync"
import { parseTypeStatement } from "./types"
import { parseConst, parseVar } from "./vars"
import { parseWhileStatement } from "./while"
import { parseClassAttribute, parseClassConstructor, parseClassFunc, parseClassStatement } from "./class"
import { parseExportStatement } from "./export"
import { parseImportStatement } from "./import"

let isIfElseChain = false
const ifElseChain: Cursor<Token>[] = []

export function parseEnvironment(build: Build, tokens: Token[][], preEnv?: Environment, wrappers?: Wrappers) {

    const env: Environment = preEnv || {
        fields: {
            local: {},
        },
    }

    const tree: Statement[] = []
    const typeModule: { [key: string]: Type } = {}

    let lineIndex = 0
    for (const line of tokens) {
        const lineState: LineState = {
            build,
            env,
            lineIndex: lineIndex++,
        }
        const cursor = new Cursor(line)
        if(cursor.done) continue
        const statement = parseLine({ lineState, cursor, wrappers })
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
        tree.push(parseIfStatement({ build, env, lineIndex: lineIndex++ }, new Cursor(ifElseChain), wrappers))
        ifElseChain.length = 0
    }

    return { tree, typeModule }
}

function parseLine({ lineState, cursor, wrappers }: { lineState: LineState; cursor: Cursor<Token>; wrappers?: Wrappers; }): Statement | void {

    const token = cursor.peek()

    if(isIfElseChain) {
        if(token.type === 'keyword' && token.value === 'else') {
            ifElseChain.push(cursor)
            return
        }
        else {
            isIfElseChain = false
            ifElseChain.length = 0
            const ifStatement = parseIfStatement(lineState, new Cursor(ifElseChain), wrappers)
            const nextStatement = parseLine({ lineState, cursor, wrappers })
            
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
            case 'const': return parseConst(lineState, cursor)
            case 'var': return parseVar(lineState, cursor)
            case 'func': return parseFunc({ lineState, cursor, wrappers }).statement
            case 'return': return parseReturn(lineState, cursor, wrappers)
            case 'sync': return parseSync(lineState, cursor)
            case 'type': return parseTypeStatement(lineState, cursor)
            case 'if': {
                isIfElseChain = true
                ifElseChain.push(cursor)
                return
            }
            case 'while': return parseWhileStatement(lineState, cursor, wrappers)
            case 'for': return parseForStatement(lineState, cursor, wrappers)
            case 'break': return parseBreakStatement(lineState, cursor, wrappers)
            case 'continue': return parseContinueStatement(lineState, cursor, wrappers)
            case 'class': return parseClassStatement(lineState, cursor)
            case 'export': return parseExportStatement(lineState, cursor, wrappers)
            case 'import': return parseImportStatement(lineState, cursor, wrappers)
        }
        throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
    }
    // parse steps
    return {
        type: 'expressionStatement',
        expression: ExpressionParser.parse(lineState, cursor).value
    }
}

export function parseClassEnv(build: Build, tokens: Token[][], env: Environment, wrappers: Wrappers) {

    const tree: { statement: ClassStatement, type: Type }[] = []

    let lineIndex = 0
    for (const line of tokens) {
        const lineState: LineState = {
            build,
            env,
            lineIndex: lineIndex++,
        }
        const cursor = new Cursor(line)
        if(cursor.done) continue
        const statement = parseClassLine({ lineState, cursor, wrappers, modifiers: {} })
        if(statement) tree.push(statement)
    }

    return { tree, env }
}

function parseClassLine({ lineState, cursor, wrappers, modifiers }: { lineState: LineState; cursor: Cursor<Token>; wrappers: Wrappers; modifiers: Modifiers }): { statement: ClassStatement, type: Type } | void {

    const token = cursor.next()

    if(token.type === 'modifier') {
        switch(token.value) {
            case 'public': {
                if(modifiers.access) throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                modifiers.access = 'public'
                return parseClassLine({ lineState, cursor, wrappers, modifiers })
            }
            case 'private': {
                if(modifiers.access) throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                modifiers.access = 'private'
                return parseClassLine({ lineState, cursor, wrappers, modifiers })
            }
            case 'static': {
                if(modifiers.isStatic) throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                modifiers.isStatic = true
                return parseClassLine({ lineState, cursor, wrappers, modifiers })
            }
            case 'abstract': {
                if(modifiers.isAbstract) throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                modifiers.isAbstract = true
                return parseClassLine({ lineState, cursor, wrappers, modifiers })
            }
        }
    }
    else if(token.type === 'keyword') {
        switch(token.value) {
            case 'const': {
                modifiers.isFinal = true
                return parseClassAttribute(lineState, cursor, wrappers, modifiers)
            }
            case 'var': {
                modifiers.isFinal = false
                return parseClassAttribute(lineState, cursor, wrappers, modifiers)
            }
            case 'func': return parseClassFunc(lineState, cursor, wrappers, modifiers)
            case 'constructor': return parseClassConstructor(lineState, cursor, wrappers, modifiers)
        }
    }
    throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
}