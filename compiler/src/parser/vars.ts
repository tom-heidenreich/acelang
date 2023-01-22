import { LineState, Statement, Token, Type } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import TypeCheck from "../util/TypeCheck"
import Values from "./values"
import { parseType } from "./types"

export function parseDeclaration(lineState: LineState, cursor: Cursor<Token>, isConst: boolean = false): { statement: Statement, type: Type } {

    // name
    const name = cursor.next()
    if(name.type !== 'identifier') {
        throw new Error(`Unexpected token ${name.type} ${name.value} at line ${lineState.lineIndex}`)
    }
    // check if field exists
    const searchedField = FieldResolve.resolve(lineState.env.fields, name.value)
    if(searchedField) {
        throw new Error(`Field ${name.value} already exists at line ${lineState.lineIndex}`)
    }

    // type
    let type: Type | undefined
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next()
        const typeToken = cursor.until(token => token.type === 'symbol' && token.value === '=')
        if(typeToken.remainingLength === 0 && isConst) {
            throw new Error(`Unexpected symbol '=' at line ${lineState.lineIndex}`)
        }
        type = parseType(lineState, typeToken)
    }

    if(!cursor.done) {

        if(cursor.peek().type === 'symbol' && cursor.peek().value === '=') {
            cursor.next()
        }

        // value
        const valueToken = Values.parseValue(lineState, cursor)
        const value = valueToken.value

        // dynamic type
        if(!type) {
            type = valueToken.type
        }
        // check if types match
        else if(!TypeCheck.matches(lineState.build.types, type, valueToken.type)) {
            throw new Error(`Types ${TypeCheck.stringify(type)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
        }

        // add field
        lineState.env.fields.local[name.value] = {
            type,
        }
        
        if(isConst) return {
            type,
            statement: {
                type: 'constantDeclaration',
                name: name.value,
                value,
            }
        }
        else return {
            type,
            statement: {
                type: 'variableDeclaration',
                name: name.value,
                value,
            }
        }

    }
    else if(!isConst){

        // check if type exists
        if(!type) {
            throw new Error(`No type found at line ${lineState.lineIndex}`)
        }

        // add field
        lineState.env.fields.local[name.value] = {
            type,
        }

        return {
            type,
            statement: {
                type: 'variableDeclaration',
                name: name.value,
            }
        }
    }
    else {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }
}

export function parseConst(lineState: LineState, cursor: Cursor<Token>) {
    return parseDeclaration(lineState, cursor, true).statement
}

export function parseVar(lineState: LineState, cursor: Cursor<Token>) {
    return parseDeclaration(lineState, cursor, false).statement
}
