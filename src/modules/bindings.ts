import * as fs from 'fs';

import { Binding, DATATYPES, Context, Token, Type, Types } from "../types"
import { lex } from '../lexer';
import Logger from '../util/logger';
import Cursor from '../util/cursor';
import { parseType } from '../parser/types';
import line from '../util/LineStringify';

export function parseBindingsFile(file_path: string): Binding[] {
    
    const file_content = fs.readFileSync(file_path, 'utf-8');
    const lines = lex(file_content, file_path, new Logger())
    
    const bindings = []

    const defaultTypes: Types = {}
    for (const type of DATATYPES) {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type,
        }
    }
    const build = {
        types: defaultTypes,
        callables: {},
        imports: [],
        exports: [],
    }
    const env = { fields: { local: {} } }
    
    let lineIndex = 0;
    for(const tokens of lines) {

        const context: Context = {
            build,
            env
        }
        lineIndex++;

        bindings.push(parseBinding(context, new Cursor(tokens)))
    }
    
    return bindings
}

// TODO: not only support function bindings
function parseBinding(context: Context, cursor: Cursor<Token>): Binding {
    
    const declareToken = cursor.next()
    if(declareToken.type !== 'keyword' || declareToken.value !== 'declare') {
        throw new Error(`Expected 'declare' got ${declareToken.type} ${declareToken.value}`)
    }

    const returnTypeToken = cursor.next()
    const returnType = parseType(context, new Cursor([returnTypeToken]))

    const nameToken = cursor.next()
    if(nameToken.type !== 'identifier') {
        throw new Error(`Expected identifier got ${nameToken.type} ${nameToken.value}`)
    }

    // params
    const paramsToken = cursor.next()
    if(paramsToken.type !== 'block' || paramsToken.value !== '()') {
        throw new Error(`Unexpected token ${paramsToken.type} ${paramsToken.value} at ${line(paramsToken)}`)
    }
    if(!paramsToken.block) {
        throw new Error(`Unexpected end of line at ${line(paramsToken)}`)
    }
    const params: Type[] = []
    for(const paramToken of paramsToken.block) {
        params.push(parseType(context, new Cursor(paramToken)))
    }

    return {
        type: 'function',
        name: nameToken.value,
        returnType,
        params,
    }
}