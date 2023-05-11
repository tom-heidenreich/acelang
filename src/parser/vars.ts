import { Context, Statement, Token, Type } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import TypeCheck from "../util/TypeCheck"
import { parseType } from "./types"
import line from "../util/LineStringify"

export function parseDeclaration(context: Context, cursor: Cursor<Token>, isConst: boolean = false): { statement: Statement, type: Type } {

    // name
    const nameToken = cursor.next()

    let names: string[] = []
    
    let destructuringType: 'array' | 'object' | undefined
    if(nameToken.type === 'block') {
        if(!nameToken.block) throw new Error(`Unexpected end of line at ${line(nameToken)}`)
        // destructuring
        if(nameToken.value === '[]') {
            // array destructuring
            destructuringType = 'array'
            names = nameToken.block.map(tokens => {
                if(tokens.length !== 1) throw new Error(`Expected identifier at ${line(nameToken)}`)
                const token = tokens[0]
                if(token.type !== 'identifier') throw new Error(`Unexpected token ${token.type} ${token.value} at ${line(token)}`)
                return token.value
            })
        }
        else if(nameToken.value === '{}') {
            // object destructuring
            destructuringType = 'object'
            names = nameToken.block.map(tokens => {
                if(tokens.length !== 1) throw new Error(`Expected identifier at ${line(nameToken)}`)
                const token = tokens[0]
                if(token.type !== 'identifier') throw new Error(`Unexpected token ${token.type} ${token.value} at ${line(token)}`)
                return token.value
            })
        }
        else throw new Error(`Unexpected token ${nameToken.type} ${nameToken.value} at ${line(nameToken)}`)
    }
    else if(nameToken.type !== 'identifier') {
        throw new Error(`Unexpected token ${nameToken.type} ${nameToken.value} at ${line(nameToken)}`)
    }
    else names.push(nameToken.value)

    // check if any field exists
    names.forEach(name => {
        const searchedField = FieldResolve.resolve(context.env.fields, name)
        if(searchedField) {
            throw new Error(`Field ${name} already exists at ${line(nameToken)}`)
        }
    })

    // type
    let type: Type | undefined
    if(cursor.peek().type === 'symbol' && cursor.peek().value === ':') {
        cursor.next()
        const typeToken = cursor.until(token => token.type === 'operator' && token.value === '=')
        if(typeToken.remainingLength === 0 && isConst) {
            throw new Error(`Unexpected symbol '=' at ${line(typeToken.peek())}`)
        }
        type = parseType(context, typeToken)
    }

    if(!cursor.done) {

        if(cursor.peek().type === 'operator' && cursor.peek().value === '=') {
            cursor.next()
        }

        // value
        const valueToken = cursor.peek()
        const valueNode = context.values.parseValue(context, cursor.remaining(), type)
        const value = valueNode.value

        // dynamic type
        if(!type) {
            type = valueNode.type
        }
        // check if types match
        else if(!TypeCheck.matches(context.build.types, type, valueNode.type)) {
            throw new Error(`Types ${TypeCheck.stringify(type)} and ${TypeCheck.stringify(valueNode.type)} do not match at ${line(valueToken)}`)
        }

        // add fields
        if(destructuringType === 'array') {
            if(type.type !== 'array') {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at ${line(valueToken)}`)
            }
            const items = type.items
            names.forEach(name => {
                context.env.fields.local[name] = {
                    type: {
                        type: 'pointer',
                        pointer: items
                    },
                    isConst
                }
            })
        }
        else if(destructuringType === 'object') {
            if(type.type === 'struct') {
                const properties = type.properties
                names.forEach(name => {
                    if(!properties[name]) {
                        throw new Error(`Field ${name} does not exist at ${line(valueToken)}`)
                    }
                    context.env.fields.local[name] = {
                        type: {
                            type: 'pointer',
                            pointer: properties[name]
                        },
                        isConst
                    }
                })
            }
            else if(type.type === 'object') {
                const values = type.values
                names.forEach(name => {
                    context.env.fields.local[name] = {
                        type: {
                            type: 'pointer',
                            pointer: values
                        },
                        isConst
                    }
                })
            }
            else {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at ${line(valueToken)}`)
            }
        }
        else {
            context.env.fields.local[names[0]] = {
                type: {
                    type: 'pointer',
                    pointer: type
                },
                isConst
            }
        }

        if(names.length === 1) return {
            type: {
                type: 'pointer',
                pointer: type
            },
            statement: {
                type: 'variableDeclaration',
                name: names[0],
                value,
                valueType: type
            }
        }
        else return {
            type: {
                type: 'pointer',
                pointer: type
            },
            statement: {
                type: 'multiStatement',
                statements: names.map(name => ({
                    type: 'variableDeclaration',
                    name,
                    value,
                    valueType: type!
                }))
            }
        }

    }
    else if(!isConst){
        cursor.rollback()

        // check if type exists
        if(!type) {
            throw new Error(`No type found at ${line(cursor.peek())}`)
        }
        // type has to include undefined
        if(!TypeCheck.matchesPrimitive(context.build.types, type, 'undefined')) {
            throw new Error(`Type ${TypeCheck.stringify(type)} does not include undefined at ${line(cursor.peek())}`)
        }

        // add fields
        if(destructuringType === 'array') {
            if(type.type !== 'array') {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at ${line(cursor.peek())}`)
            }
            const items = type.items
            names.forEach(name => {
                context.env.fields.local[name] = {
                    type: {
                        type: 'pointer',
                        pointer: items
                    }
                }
            })
        }
        else if(destructuringType === 'object') {
            if(type.type === 'struct') {
                const properties = type.properties
                names.forEach(name => {
                    if(!properties[name]) {
                        throw new Error(`Field ${name} does not exist at ${line(cursor.peek())}`)
                    }
                    context.env.fields.local[name] = {
                        type: {
                            type: 'pointer',
                            pointer: properties[name]
                        }
                    }
                })
            }
            else if(type.type === 'object') {
                const values = type.values
                names.forEach(name => {
                    context.env.fields.local[name] = {
                        type: {
                            type: 'pointer',
                            pointer: values
                        }
                    }
                })
            }
            else {
                throw new Error(`Cannot destructure type ${TypeCheck.stringify(type)} at ${line(cursor.peek())}`)
            }
        }
        else {
            context.env.fields.local[names[0]] = {
                type: {
                    type: 'pointer',
                    pointer: type
                }
            }
        }

        if(names.length === 1) return {
            type: {
                type: 'pointer',
                pointer: type
            },
            statement: {
                type: 'variableDeclaration',
                name: names[0],
                valueType: type
            }
        }
        else return {
            type: {
                type: 'pointer',
                pointer: type
            },
            statement: {
                type: 'multiStatement',
                statements: names.map(name => ({
                    type: 'variableDeclaration',
                    name,
                    valueType: type!
                }))
            }
        }
    }
    else {
        throw new Error(`Unexpected end of line at ${line(cursor.peek())}`)
    }
}

export function parseConst(context: Context, cursor: Cursor<Token>) {
    return parseDeclaration(context, cursor, true).statement
}

export function parseVar(context: Context, cursor: Cursor<Token>) {
    return parseDeclaration(context, cursor, false).statement
}
