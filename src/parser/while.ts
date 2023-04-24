import { Context, Statement, Token, Wrappers } from "../types"
import Cursor from "../util/cursor";
import line from "../util/LineStringify";
import TypeCheck from "../util/TypeCheck";
import { parseEnvironment } from "./env";

export function parseWhileStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    
    const condition = cursor.next()
    if(condition.type !== 'block' || condition.value !== '()') {
        throw new Error(`Unexpected token ${condition.type} ${condition.value} at ${line(condition)}`)
    }
    else if(!condition.block) throw new Error(`Unexpected end of line at ${line(condition)}`)
    else if(condition.block.length === 0) throw new Error(`Unexpected end of line at ${line(condition)}`)
    else if(condition.block.length > 1) {
        throw new Error(`Unexpected token ${condition.block[1][0].type} ${condition.block[1][0].value} at ${line(condition.block[1][0])}`)
    }

    const conditionValue = context.values.parseValue(context, new Cursor(condition.block[0]))
    if(!TypeCheck.matchesPrimitive(context.build.types, conditionValue.type, 'boolean')) {
        throw new Error(`Expected boolean value at ${line(condition)}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at ${line(bodyToken)}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at ${line(bodyToken)}`)

    // create new env
    const env = {
        fields: {
            local: {},
            parent: context.env.fields,
        }
    }
    // create new wrappers
    const newWrappers = {
        current: {
            breakable: true,
            continuable: true,
        },
        parent: wrappers,
    }

    // parse body
    const body = parseEnvironment(context.build, bodyToken.block, context.moduleManager, env, newWrappers)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at ${line(cursor.peek())}`)

    return {
        type: 'whileStatement',
        condition: conditionValue.value,
        body: body.tree,
    }
}