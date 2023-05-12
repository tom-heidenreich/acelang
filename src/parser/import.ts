import { Context, Statement, Token, Wrappers } from "../types"
import line from "../util/LineStringify"
import Cursor from "../util/cursor"

// TODO: add support for relative paths

export function parseImportStatement(context: Context, cursor: Cursor<Token>, wrappers?: Wrappers): Statement {
    if(wrappers) throw new Error(`Unexpected import at ${line(cursor.peekLast())}`)

    // names
    const nameToken = cursor.next()

    const names: {
        module: string,
        alias?: string,
    }[] = []
    if(nameToken.type === 'identifier') {
        names.push({
            module: nameToken.value,
        })
    }
    else if(nameToken.type === 'block' && nameToken.value === '{}') {
        // destructuring
        if(!nameToken.block) throw new Error(`Unexpected end of line at ${line(nameToken)}`)
        else if(nameToken.block.length === 0) throw new Error(`Unexpected end of line at ${line(nameToken)}`)

        const blockCursor = new Cursor(nameToken.block)
        while(!blockCursor.done) {
            const moduleCursor = new Cursor(blockCursor.next())
            
            const moduleNameToken = moduleCursor.next()
            if(moduleNameToken.type !== 'identifier') {
                throw new Error(`Expected identifier got ${moduleNameToken.type} ${moduleNameToken.value} at ${line(moduleNameToken)}`)
            }

            if(moduleCursor.done) {
                names.push({
                    module: moduleNameToken.value,
                })
                continue
            }

            const asToken = moduleCursor.next()
            if(asToken.type !== 'keyword' || asToken.value !== 'as') {
                throw new Error(`Expected 'as' got ${asToken.type} ${asToken.value} at ${line(asToken)}`)
            }

            const aliasToken = moduleCursor.next()
            if(aliasToken.type !== 'identifier') {
                throw new Error(`Expected identifier got ${aliasToken.type} ${aliasToken.value} at ${line(aliasToken)}`)
            }

            names.push({
                module: moduleNameToken.value,
                alias: aliasToken.value,
            })

            throw new Error(`Alias not supported yet at ${line(aliasToken)}`)
        }
    }

    // check if any name is already defined
    for(const name of names) {
        const fieldName = name.alias || name.module
        if(context.scope.has(fieldName)) throw new Error(`Name ${fieldName} is already defined at ${line(nameToken)}`)
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
        const fieldName = name.alias || name.module
        const filtered = bindings.filter(binding => binding.name === name.module)
        if(filtered.length === 0) throw new Error(`Could not find ${name.module} in module ${moduleToken.value} at ${line(moduleToken)}`)
        
        const binding = filtered[0]

        context.build.imports.push(binding)
        const callable = {
            name: fieldName,
            params: binding.params.map((param, index) => ({
                name: `param${index}`,
                type: param,
            })),
            returnType: binding.returnType,
            body: [],
            isSync: true,
            isBuiltIn: true,
        }
        context.build.callables[fieldName] = callable
        context.scope.setGlobal(fieldName, {
            type: {
                type: 'callable',
                params: binding.params,
                returnType: binding.returnType,
            }
        })
    }
    context.moduleManager.useModule(moduleToken.value)
    
    return {
        type: 'importStatement'
    }
}