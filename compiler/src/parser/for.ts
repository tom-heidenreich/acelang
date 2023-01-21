import { LineState, Statement, Token, Wrappers } from "../types";
import Cursor from "../util/cursor";
import TypeCheck from "../util/TypeCheck";
import { parseEnvironment } from "./env";
import Values from "./values";

export function parseForStatement(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {

    // get identifier
    const identifier = cursor.next()
    if(identifier.type !== 'identifier') throw new Error(`Expected identifier, got ${identifier.type} ${identifier.value}`)

    if(cursor.peek().type !== 'keyword' || cursor.peek().value !== 'of') throw new Error(`Expected keyword of, got ${cursor.peek().type} ${cursor.peek().value}`)
    cursor.next()

    // get iterable
    const iterable = Values.parseValue(lineState, new Cursor([cursor.next()]))
    const resolvedType = TypeCheck.resolveReferences(lineState.build.types, iterable.type)
    if(resolvedType.type !== 'array') {
        throw new Error(`Expected array, got ${TypeCheck.stringify(resolvedType)}`)
    }

    const bodyToken = cursor.next()
    if(bodyToken.type !== 'block' || bodyToken.value !== '{}') {
        throw new Error(`Unexpected token ${bodyToken.type} ${bodyToken.value} at line ${lineState.lineIndex}`)
    }
    else if(!bodyToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)

    // create new env
    const env = {
        fields: {
            local: {
                [identifier.value]: {
                    type: iterable.type,
                }
            },
            parent: lineState.env.fields,
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
    const body = parseEnvironment(lineState.build, bodyToken.block, env, newWrappers)
    
    if(!cursor.done) throw new Error(`Unexpected token ${cursor.peek().type} ${cursor.peek().value} at line ${lineState.lineIndex}`)

    return {
        type: 'forStatement',
        iterable: iterable.value,
        variable: identifier.value,
        body: body.tree,
    }
}