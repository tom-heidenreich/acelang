import { IfStatement, LineState, Statement, Token } from "../types";
import Cursor from "../util/cursor";
import TypeCheck from "../util/TypeCheck";
import { parseEnvironment } from "./env";
import Values from "./values";

export function parseIfStatement(lineState: LineState, cursors: Cursor<Cursor<Token>>): IfStatement {

    // if statement
    const cursor = cursors.next()
    
    const condition = cursor.next()
    if(condition.type !== 'block' || condition.value !== '()') {
        throw new Error(`Unexpected token ${condition.type} ${condition.value} at line ${lineState.lineIndex}`)
    }
    else if(!condition.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    else if(condition.block.length === 0) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    else if(condition.block.length > 1) {
        throw new Error(`Unexpected token ${condition.block[1][0].type} ${condition.block[1][0].value} at line ${lineState.lineIndex}`)
    }
    const conditionValue = Values.parseValue(lineState, new Cursor(condition.block[0]))
    if(!TypeCheck.matchesPrimitive(lineState.build.types, conditionValue.type, 'boolean')) {
        throw new Error(`Expected boolean value at line ${lineState.lineIndex}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)

    // create new env
    const env = {
        fields: {
            local: {},
            parent: lineState.env.fields,
        }
    }

    // parse body
    const body = parseEnvironment(lineState.build, bodyToken.block, env)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)

    // parse else
    const elseIf: IfStatement[] = []
    let elseStatement: Statement[] | undefined
    while(!cursors.done) {
        if(!cursors.hasOnlyOne()) elseIf.push(parseElseIfStatement(lineState, cursors.next()))
        else {
            elseStatement = parseElseStatement(lineState, cursors.next())
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

function parseElseIfStatement(lineState: LineState, cursor: Cursor<Token>): IfStatement {
    
    const keyword = cursor.next()
    if(keyword.type !== 'keyword' || keyword.value !== 'else') {
        throw new Error(`Unexpected token ${keyword.type} ${keyword.value} at line ${lineState.lineIndex}`)
    }

    const ifKeyword = cursor.peek()
    if(ifKeyword.type !== 'keyword' || ifKeyword.value !== 'if') {
        throw new Error(`Unexpected token ${ifKeyword.type} ${ifKeyword.value} at line ${lineState.lineIndex}`)
    }
    
    return parseIfStatement(lineState, new Cursor([cursor]))
}

function parseElseStatement(lineState: LineState, cursor: Cursor<Token>): Statement[] {

    const keyword = cursor.next()
    if(keyword.type !== 'keyword' || keyword.value !== 'else') {
        throw new Error(`Unexpected token ${keyword.type} ${keyword.value} at line ${lineState.lineIndex}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)

    // create new env
    const env = {
        fields: {
            local: {},
            parent: lineState.env.fields,
        }
    }

    // parse body
    const body = parseEnvironment(lineState.build, bodyToken.block, env)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)

    return body.tree
}