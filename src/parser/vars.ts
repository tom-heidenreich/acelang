import { ArrayType, Context, PointerType, Statement, StructType, Token, Type } from "../types"
import Cursor from "../util/cursor"
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
        const searchedField = context.scope.getLocal(name)
        if(searchedField) {
            throw new Error(`Field ${name} already exists at ${line(nameToken)}`)
        }
    })

    // null safety
    var nullSafety = true
    if(cursor.peek().type === 'symbol' && cursor.peek().value === '?') {
        cursor.next()
        nullSafety = false
    }

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
        else if(!type.matches(valueNode.type)) {
            throw new Error(`Types ${type} and ${valueNode.type} do not match at ${line(valueToken)}`)
        }

        // add fields
        if(destructuringType === 'array') {
            if(!(type instanceof ArrayType)) {
                throw new Error(`Cannot destructure type ${type} at ${line(valueToken)}`)
            }
            const items = type.items
            names.forEach(name => {
                context.scope.set(name, {
                    type: new PointerType(items),
                    isConst
                })
            })
        }
        else if(destructuringType === 'object') {
            if(type instanceof StructType) {
                const properties = type.properties
                names.forEach(name => {
                    if(!properties[name]) {
                        throw new Error(`Field ${name} does not exist at ${line(valueToken)}`)
                    }
                    context.scope.set(name, {
                        type: new PointerType(properties[name]),
                        isConst
                    })
                })
            }
            // else if(type.type === 'object') {
            //     const values = type.values
            //     names.forEach(name => {
            //         context.scope.set(name, {
            //             type: {
            //                 type: 'pointer',
            //                 pointer: values
            //             },
            //             isConst
            //         })
            //     })
            // }
            else {
                throw new Error(`Cannot destructure type ${type} at ${line(valueToken)}`)
            }
        }
        else {
            context.scope.set(names[0], {
                type: new PointerType(type),
                isConst
            })
        }

        if(names.length === 1) return {
            type: new PointerType(type),
            statement: {
                type: 'variableDeclaration',
                name: names[0],
                value,
                valueType: type
            }
        }
        else return {
            type: new PointerType(type),
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
        // type has have null safety disabled
        if(nullSafety) {
            throw new Error(`Type ${type} cannot be null at ${line(cursor.peek())}`)
        }

        // add fields
        if(destructuringType === 'array') {
            if(!(type instanceof ArrayType)) {
                throw new Error(`Cannot destructure type ${type} at ${line(cursor.peek())}`)
            }
            const items = type.items
            names.forEach(name => {
                context.scope.set(name, {
                    type: new PointerType(items)
                })
            })
        }
        else if(destructuringType === 'object') {
            if(type instanceof StructType) {
                const properties = type.properties
                names.forEach(name => {
                    if(!properties[name]) {
                        throw new Error(`Field ${name} does not exist at ${line(cursor.peek())}`)
                    }
                    context.scope.set(name, {
                        type: new PointerType(properties[name])
                    })
                })
            }
            // else if(type.type === 'object') {
            //     const values = type.values
            //     names.forEach(name => {
            //         context.scope.set(name, {
            //             type: {
            //                 type: 'pointer',
            //                 pointer: values
            //             }
            //         })
            //     })
            // }
            else {
                throw new Error(`Cannot destructure type ${type} at ${line(cursor.peek())}`)
            }
        }
        else {
            context.scope.set(names[0], {
                type: new PointerType(type)
            })
        }

        if(names.length === 1) return {
            type: new PointerType(type),
            statement: {
                type: 'variableDeclaration',
                name: names[0],
                valueType: type
            }
        }
        else return {
            type: new PointerType(type),
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
