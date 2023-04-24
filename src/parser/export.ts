import { Binding, Build, Context, Statement, Token, Wrappers, Type, ReferenceValue } from "../types"
import line from "../util/LineStringify"
import TypeCheck from "../util/TypeCheck"
import Cursor from "../util/cursor"

export function parseExportStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(wrappers) throw new Error(`Unexpected export at ${line(cursor.peekLast())}`)

    const valueCursor = cursor.until(token => token.type === 'keyword' && token.value === 'as')
    const valueNode = context.values.parseValue(context, valueCursor)

    if(cursor.done) {
        const value = valueNode.value
        if(!(value instanceof ReferenceValue)) {
            throw new Error(`Cannot export anonymous value at ${line(cursor.peek())}`)
        }

        addToBuild(context.build, value.reference, TypeCheck.dereference(valueNode.type))

        return {
            type: 'exportStatement',
            value: valueNode.value,
            exportType: valueNode.type,
            name: value.reference,
        }
    }
    else {
        // as
        const asToken = cursor.next()
        if(asToken.type !== 'keyword' || asToken.value !== 'as') {
            throw new Error(`Expected 'as' got ${asToken.type} ${asToken.value} at ${line(asToken)}`)
        }

        // name
        const nameToken = cursor.next()
        if(nameToken.type !== 'identifier') {
            throw new Error(`Expected identifier got ${nameToken.type} ${nameToken.value} at ${line(nameToken)}`)
        }

        addToBuild(context.build, nameToken.value, TypeCheck.dereference(valueNode.type))

        return {
            type: 'exportStatement',
            value: valueNode.value,
            exportType: valueNode.type,
            name: nameToken.value,
        }
    }
}

function addToBuild(build: Build, name: string, type: Type) {
    if(type.type !== 'callable') throw new Error('Currently only callable types can be exported')

    // check if export already exists
    const exists = build.exports.find(binding => binding.name === name)
    if(exists) {
        throw new Error(`Export with name ${name} already exists`)
    }

    const binding: Binding = {
        type: 'function',
        name,
        params: type.params,
        returnType: type.returnType,
    }

    build.exports.push(binding)
}