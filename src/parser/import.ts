import { LineState, Statement, Token, Wrappers } from "../types"
import Cursor from "../util/cursor"
import * as fs from 'fs'
import path from 'path';
import { lex } from "../lexer";
import { parseToTree } from "../parser";
import Logger from "../util/logger";

export function parseImportStatement(lineState: LineState, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(wrappers) throw new Error(`Unexpected import at line ${lineState.lineIndex}`)

    // names
    const nameToken = cursor.next()

    const names: string[] = []
    if(nameToken.type === 'identifier') {
        names.push(nameToken.value)
    }
    else if(nameToken.type === 'block' && nameToken.value === '{}') {
        // destructuring
        if(!nameToken.block) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
        else if(nameToken.block.length === 0) throw new Error(`Unexpected end of line at line ${lineState.lineIndex}`)
        else if(nameToken.block.length > 1) {
            throw new Error(`Unexpected token ${nameToken.block[1][0].type} ${nameToken.block[1][0].value} at line ${lineState.lineIndex}`)
        }

        names.push(...nameToken.block[0].map(token => {
            if(token.type !== 'identifier') {
                throw new Error(`Unexpected token ${token.type} ${token.value} at line ${lineState.lineIndex}`)
            }
            return token.value
        }))
    }

    // from
    const fromToken = cursor.next()
    if(fromToken.type !== 'keyword' || fromToken.value !== 'from') {
        throw new Error(`Expected 'from' got ${fromToken.type} ${fromToken.value} at line ${lineState.lineIndex}`)
    }

    // path
    const pathToken = cursor.next()
    if(pathToken.type !== 'datatype' || pathToken.specificType !== 'string') {
        throw new Error(`Expected string got ${pathToken.type} ${pathToken.value} at line ${lineState.lineIndex}`)
    }
    
    // get file extension
    const extension = pathToken.value.split('.').pop()
    if(!extension) throw new Error(`Invalid path ${pathToken.value} at line ${lineState.lineIndex}`)
    
    if(extension !== process.env.FILE_EXTENSION) {
        throw new Error(`Cannot import file with extension ${extension} at line ${lineState.lineIndex}`)
    }
    const filePath = path.join(process.env.WORK_DIR!, pathToken.value)
    
    // check if file exists
    if(!fs.existsSync(filePath)) {
        throw new Error(`Cannot find file ${filePath} at line ${lineState.lineIndex}`)
    }

    // get file contents
    const contents = fs.readFileSync(filePath, 'utf8');

    // lex file contents
    const tokens = lex(contents, new Logger())

    // parse file contents
    const { tree, typeModule } = parseToTree(lineState.moduleManager, tokens)

    // add type module to env
    for(const name of names) {
        if(typeModule[name]) {
            lineState.env.fields.local[name] = {
                type: typeModule[name]
            }
        }
        else {
            throw new Error(`Module ${filePath} does not export ${name} at line ${lineState.lineIndex}`)
        }
    }

    return {
        type: 'multiStatement',
        statements: tree
    }
}