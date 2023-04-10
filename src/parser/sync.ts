import { Identifier, LineState, Statement, Token } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import { parseEnvironment } from "./env"
import { parseFunc } from "./functions"

export function parseSync(lineState: LineState, cursor: Cursor<Token>): Statement {

    // check if next token is function
    let token = cursor.next()
    if(token.type === 'keyword' && token.value === 'func') {
        return parseFunc({ lineState, cursor, isSync: true }).statement
    }

    if(token.type !== 'block') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
    }

    const lockedFields: Identifier[] = []
    if(token.value === '()') {
        token.block?.forEach(line => {
            if(line.length === 0) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
            else if(line.length > 1) {
                throw new Error(`Unexpected token ${line[1].type} ${line[1].value} at line ${lineState.lineIndex}`)
            }
            const token = line[0]
            if(token.type !== 'identifier') {
                throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
            }
            // check if field exists
            if(!FieldResolve.resolve(lineState.env.fields, token.value)) {
                throw new Error(`Field ${token.value} does not exist at line ${lineState.lineIndex}`)
            }
            lockedFields.push(token.value)
        })
        token = cursor.next()
    }

    if(token.value !== '{}') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
    }

    if(!token.block) {
        throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    }

    // create new env
    const env = {
        fields: {
            local: {},
            parent: lineState.env.fields,
        }
    }
    
    // parse body
    const body = parseEnvironment(lineState.build, token.block, lineState.moduleManager, env)

    return {
        type: 'syncStatement',
        lockedFields,
        body: body.tree,
    }
}