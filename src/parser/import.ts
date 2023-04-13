import { Context, Statement, Token, Wrappers } from "../types"
import line from "../util/LineStringify"
import Cursor from "../util/cursor"

// TODO: add support for relative paths

export function parseImportStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(wrappers) throw new Error(`Unexpected import at ${line(cursor.peekLast())}`)

    // names
    const nameToken = cursor.next()

    const names: string[] = []
    if(nameToken.type === 'identifier') {
        names.push(nameToken.value)
    }
    else if(nameToken.type === 'block' && nameToken.value === '{}') {
        // destructuring
        if(!nameToken.block) throw new Error(`Unexpected end of line at ${line(nameToken)}`)
        else if(nameToken.block.length === 0) throw new Error(`Unexpected end of line at ${line(nameToken)}`)
        else if(nameToken.block.length > 1) {
            throw new Error(`Unexpected token ${nameToken.block[1][0].type} ${nameToken.block[1][0].value} at ${line(nameToken)}`)
        }

        names.push(...nameToken.block[0].map(token => {
            if(token.type !== 'identifier') {
                throw new Error(`Unexpected token ${token.type} ${token.value} at ${line(token)}`)
            }
            return token.value
        }))
    }

    // check if any name is already defined
    for(const name of names) {
        if(context.env.fields.local[name]) throw new Error(`Name ${name} is already defined at ${line(nameToken)}`)
    }

    // from
    const fromToken = cursor.next()
    if(fromToken.type !== 'keyword' || fromToken.value !== 'from') {
        throw new Error(`Expected 'from' got ${fromToken.type} ${fromToken.value} at ${line(fromToken)}`)
    }

    // module
    const moduleToken = cursor.next()
    if(moduleToken.type !== 'datatype' || moduleToken.specificType !== 'string') {
        throw new Error(`Expected string got ${moduleToken.type} ${moduleToken.value} at ${line(moduleToken)}`)
    }

    if(!context.moduleManager) throw new Error(`Unexpected import at ${line(moduleToken)}`)

    // check if module is installed
    const module = context.moduleManager.getModule(moduleToken.value)
    if(!module) throw new Error(`Could not find module ${moduleToken.value} at ${line(moduleToken)}`)

    // check if module exports all names
    const bindings = module.bindings
    for(const name of names) {
        const filtered = bindings.filter(binding => binding.name === name)
        if(filtered.length === 0) throw new Error(`Could not find ${name} in module ${moduleToken.value} at ${line(moduleToken)}`)

        const binding = filtered[0]

        context.build.imports.push(binding)
        const callable = {
            params: binding.params.map((param, index) => ({
                name: `param${index}`,
                type: param,
            })),
            returnType: binding.returnType,
            body: [],
            isSync: true,
            isBuiltIn: true,
        }
        context.build.callables[binding.name] = callable
        context.env.fields.local[binding.name] = {
            type: {
                type: 'callable',
                params: binding.params,
                returnType: binding.returnType,
            }
        }
    }
    context.moduleManager.useModule(moduleToken.value)
    
    return {
        type: 'importStatement'
    }
}