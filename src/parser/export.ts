import { Binding, Build, LineState, Statement, Token, Wrappers, Type } from "../types"
import TypeCheck from "../util/TypeCheck"
import Cursor from "../util/cursor"
import Values from "./values"

export function parseExportStatement(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(wrappers) throw new Error(`Unexpected export at line ${lineState.lineIndex}`)

    const valueCursor = cursor.until(token => token.type === 'keyword' && token.value === 'as')
    const valueNode = Values.parseValue(lineState, valueCursor)

    if(cursor.done) {
        if(valueNode.value.type !== 'reference') {
            throw new Error(`Cannot export anonymous value at line ${lineState.lineIndex}`)
        }

        addToBuild(lineState.build, valueNode.value.reference, TypeCheck.dereference(valueNode.type))

        return {
            type: 'exportStatement',
            value: valueNode.value,
            exportType: valueNode.type,
            name: valueNode.value.reference,
        }
    }
    else {
        // as
        const asToken = cursor.next()
        if(asToken.type !== 'keyword' || asToken.value !== 'as') {
            throw new Error(`Expected 'as' got ${asToken.type} ${asToken.value} at line ${lineState.lineIndex}`)
        }

        // name
        const nameToken = cursor.next()
        if(nameToken.type !== 'identifier') {
            throw new Error(`Expected identifier got ${nameToken.type} ${nameToken.value} at line ${lineState.lineIndex}`)
        }

        addToBuild(lineState.build, nameToken.value, TypeCheck.dereference(valueNode.type))

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