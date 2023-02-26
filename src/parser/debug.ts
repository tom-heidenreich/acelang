import { LineState, Token } from "../types";
import Cursor from "../util/cursor";
import FieldResolve from "../util/FieldResolve";
import Logger from "../util/logger";
import TypeCheck from "../util/TypeCheck";

export function parseDebug(lineState: LineState, cursor: Cursor<Token>) {

    const token = cursor.next();
    if(token.type !== 'identifier') {
        throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`);
    }
    const name = token.value;

    const field = FieldResolve.resolve(lineState.env.fields, token.value);
    if(!field) {
        throw new Error(`Unknown field: ${token.value} at line ${lineState.lineIndex}`);
    }
    
    Logger.info(`Type: ${TypeCheck.stringify(field.type)}`, { name: `Debug "${name}"` })
    Logger.info(`Resolved type: ${TypeCheck.stringify(TypeCheck.resolveReferences(lineState.build.types, field.type))}`, { name: `Debug "${name}"` })

    return
}