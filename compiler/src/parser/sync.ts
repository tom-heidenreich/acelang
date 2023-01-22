import { LineState, Statement, Token, Wrappers } from "../types"
import Cursor from "../util/cursor"
import { parseEnvironment } from "./env"
import { parseFunc } from "./functions"

export function parseSync(lineState: LineState, cursor: Cursor<Token>): Statement {

    // check if next token is function
    const token = cursor.next()
    if(token.type === 'keyword' && token.value === 'func') {
        return parseFunc({ lineState, cursor, isSync: true }).statement
    }

    if(token.type !== 'block' || token.value !== '{}') {
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
    const body = parseEnvironment(lineState.build, token.block, env)

    return {
        type: 'syncStatement',
        body: body.tree,
    }
}