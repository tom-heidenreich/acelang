import { LineState, Statement, Token } from "../types"
import Cursor from "../util/cursor";
import TypeCheck from "../util/TypeCheck";
import { parseEnvironment } from "./env";
import Values from "./values";

export function parseWhileStatement(lineState: LineState, cursor: Cursor<Token>): Statement {
    
    const condition = cursor.next()
    if(condition.type !== 'block' || condition.value !== '()') {
        throw new Error(`Unexpected token ${condition.type} ${condition.value} at line ${lineState.lineIndex}`)
    }
    else if(!condition.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    else if(condition.block.length === 0) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
    else if(condition.block.length > 1) {
        throw new Error(`Unexpected token ${condition.block[1][0].type} ${condition.block[1][0].value} at line ${lineState.lineIndex}`)
    }

    const conditionValue = Values.parseValue(lineState, new Cursor(condition.block[0]))
    if(!TypeCheck.matchesPrimitive(lineState.build.types, conditionValue.type, 'boolean')) {
        throw new Error(`Expected boolean value at line ${lineState.lineIndex}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)

    // create new env
    const env = {
        fields: {
            local: {},
            parent: lineState.env.fields,
        }
    }

    // parse body
    const body = parseEnvironment(lineState.build, bodyToken.block, env)

    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)

    return {
        type: 'whileStatement',
        condition: conditionValue.value,
        body: body.tree,
    }
}