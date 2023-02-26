import { LineState, Statement, Token, Wrappers } from "../types"
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

        return {
            type: 'exportStatement',
            value: valueNode.value,
            exportType: valueNode.type,
            name: nameToken.value,
        }
    }
}