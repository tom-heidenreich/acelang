import { LineState, Statement, Token, Type } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import TypeCheck from "../util/TypeCheck"
import Values from "./values"
import { parseType } from "./types"

export function parseDeclaration(lineState: LineState, cursor: Cursor<Token>, isConst: boolean = false): { statement: Statement, type: Type } {

    // name
    const nameToken = cursor.next()

    let names: string[] = []
    
    let destructuringType: 'array' | 'object' | undefined
    if(nameToken.type === 'block') {
        if(!nameToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
        // destructuring
        if(nameToken.value === '[]') {
            // array destructuring
            destructuringType = 'array'
            names = nameToken.block.map(tokens => {
                if(tokens.length !== 1) throw new Error(`Expected identifier at line ${lineState.lineIndex}`)
                const token = tokens[0]
                if(token.type !== 'identifier') throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                return token.value
            })
        }
        else if(nameToken.value === '{}') {
            // object destructuring
            destructuringType = 'object'
            names = nameToken.block.map(tokens => {
                if(tokens.length !== 1) throw new Error(`Expected identifier at line ${lineState.lineIndex}`)
                const token = tokens[0]
                if(token.type !== 'identifier') throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
                return token.value
            })
        }
        else throw new Error(`Unexpected token ${nameToken.type} ${nameToken.value} at line ${lineState.lineIndex}`)
    }
    else if(nameToken.type !== 'identifier') {
        throw new Error(`Unexpected token ${nameToken.type} ${nameToken.value} at line ${lineState.lineIndex}`)
    }
    else names.push(nameToken.value)

    // check if any field exists
    names.forEach(name => {
        const searchedField = FieldResolve.resolve(lineState.env.fields, name)
        if(searchedField) {
            throw new Error(`Field ${name} already exists at line ${lineState.lineIndex}`)
        }
    })

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
        const valueToken = Values.parseValue(lineState, cursor.remaining())
        const value = valueToken.value

        // dynamic type
        if(!type) {
            type = valueToken.type
        }
        // check if types match
        else if(!TypeCheck.matches(lineState.build.types, type, valueToken.type)) {
            throw new Error(`Types ${TypeCheck.stringify(type)} and ${TypeCheck.stringify(valueToken.type)} do not match at line ${lineState.lineIndex}`)
        }

        // add fields
        if(destructuringType === 'array') {
            const resolved = TypeCheck.resolveReferences(lineState.build.types, type)
            if(resolved.type !== 'array') {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at line ${lineState.lineIndex}`)
            }
            names.forEach(name => {
                lineState.env.fields.local[name] = {
                    type: resolved.items,
                }
            })
        }
        else if(destructuringType === 'object') {
            const resolved = TypeCheck.resolveReferences(lineState.build.types, type)
            if(resolved.type === 'struct') {
                names.forEach(name => {
                    if(!resolved.properties[name]) {
                        throw new Error(`Field ${name} does not exist at line ${lineState.lineIndex}`)
                    }
                    lineState.env.fields.local[name] = {
                        type: resolved.properties[name],
                    }
                })
            }
            else if(resolved.type === 'object') {
                names.forEach(name => {
                    lineState.env.fields.local[name] = {
                        type: resolved.values,
                    }
                })
            }
            else {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at line ${lineState.lineIndex}`)
            }
        }
        else {
            lineState.env.fields.local[names[0]] = {
                type,
            }
        }
        
        if(isConst) {
            if(names.length === 1) return {
                type,
                statement: {
                    type: 'constantDeclaration',
                    name: names[0],
                    value
                }
            }
            else return {
                type,
                statement: {
                    type: 'multiStatement',
                    statements: names.map(name => ({
                        type: 'constantDeclaration',
                        name,
                        value
                    }))
                }
            }
        }
        else {
            if(names.length === 1) return {
                type,
                statement: {
                    type: 'variableDeclaration',
                    name: names[0],
                    value
                }
            }
            else return {
                type,
                statement: {
                    type: 'multiStatement',
                    statements: names.map(name => ({
                        type: 'variableDeclaration',
                        name,
                        value
                    }))
                }
            }
        }

    }
    else if(!isConst){

        // check if type exists
        if(!type) {
            throw new Error(`No type found at line ${lineState.lineIndex}`)
        }
        // type has to include undefined
        if(!TypeCheck.matchesPrimitive(lineState.build.types, type, 'undefined')) {
            throw new Error(`Type ${TypeCheck.stringify(type)} does not include undefined at line ${lineState.lineIndex}`)
        }

        // add fields
        if(destructuringType === 'array') {
            const resolved = TypeCheck.resolveReferences(lineState.build.types, type)
            if(resolved.type !== 'array') {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at line ${lineState.lineIndex}`)
            }
            names.forEach(name => {
                lineState.env.fields.local[name] = {
                    type: resolved.items,
                }
            })
        }
        else if(destructuringType === 'object') {
            const resolved = TypeCheck.resolveReferences(lineState.build.types, type)
            if(resolved.type === 'struct') {
                names.forEach(name => {
                    if(!resolved.properties[name]) {
                        throw new Error(`Field ${name} does not exist at line ${lineState.lineIndex}`)
                    }
                    lineState.env.fields.local[name] = {
                        type: resolved.properties[name],
                    }
                })
            }
            else if(resolved.type === 'object') {
                names.forEach(name => {
                    lineState.env.fields.local[name] = {
                        type: resolved.values,
                    }
                })
            }
            else {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at line ${lineState.lineIndex}`)
            }
        }
        else {
            lineState.env.fields.local[names[0]] = {
                type,
            }
        }

        if(names.length === 1) return {
            type,
            statement: {
                type: 'variableDeclaration',
                name: names[0],
            }
        }
        else return {
            type,
            statement: {
                type: 'multiStatement',
                statements: names.map(name => ({
                    type: 'variableDeclaration',
                    name,
                }))
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
