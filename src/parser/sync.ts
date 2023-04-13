import { Identifier, Context, Statement, Token } from "../types"
import Cursor from "../util/cursor"
import FieldResolve from "../util/FieldResolve"
import lnStringify from "../util/LineStringify"
import { parseEnvironment } from "./env"
import { parseFunc } from "./functions"

export function parseSync(context: Context, cursor: Cursor<Token>): Statement {

    // check if next token is function
    let token = cursor.next()
    if(token.type === 'keyword' && token.value === 'func') {
        return parseFunc({ context, cursor, isSync: true }).statement
    }

    if(token.type !== 'block') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at ${lnStringify(token)}`)
    }

    const lockedFields: Identifier[] = []
    if(token.value === '()') {
        token.block?.forEach(line => {
            if(line.length === 0) throw new Error(`Unexpected end of line at ${lnStringify(token)}`)
            else if(line.length > 1) {
                throw new Error(`Unexpected token ${line[1].type} ${line[1].value} at ${lnStringify(token)}`)
            }
            const lineToken = line[0]
            if(lineToken.type !== 'identifier') {
                throw new Error(`Unexpected token ${lineToken.type} ${lineToken.value} at ${lnStringify(lineToken)}`)
            }
            // check if field exists
            if(!FieldResolve.resolve(context.env.fields, lineToken.value)) {
                throw new Error(`Field ${lineToken.value} does not exist at ${lnStringify(lineToken)}`)
            }
            lockedFields.push(lineToken.value)
        })
        token = cursor.next()
    }

    if(token.value !== '{}') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at ${lnStringify(token)}`)
    }

    if(!token.block) {
        throw new Error(`Unexpected end of line at ${lnStringify(token)}`)
    }

    // create new env
    const env = {
        fields: {
            local: {},
            parent: context.env.fields,
        }
    }
    
    // parse body
    const body = parseEnvironment(context.build, token.block, context.moduleManager, env)

    return {
        type: 'syncStatement',
        lockedFields,
        body: body.tree,
    }
}