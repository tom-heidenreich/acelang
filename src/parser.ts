import { ModuleManager } from "./modules";
import { parseEnvironment } from "./parser/env";
import { Token, DATATYPES, Types, Build, Value, Callable, ParserScope } from "./types";
import Values from "./values";

export function parseToTree(moduleManager: ModuleManager, tokens: Token[][], values: Values) {

    const defaultTypes: Types = {}
    for (const type of DATATYPES) {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type,
        }
    }

    // built in functions
    const printfFunction: Callable = {
        params: [
            {
                name: 'format',
                type: {
                    type: 'primitive',
                    primitive: 'string',
                }
            },
            {
                name: 'value',
                type: {
                    type: 'primitive',
                    primitive: 'any',
                }
            }
        ],
        returnType: {
            type: 'primitive',
            primitive: 'void',
        },
        body: [],
        isBuiltIn: true,
    }
    
    const build: Build = {
        types: defaultTypes,
        callables: {
            printf: printfFunction
        },
        imports: [],
        exports: [],
    }

    const rootScope = new ParserScope({ isRoot: true })
    rootScope.set('printf', {
        type: {
            type: 'callable',
            params: printfFunction.params.map(param => param.type),
            returnType: printfFunction.returnType,
        }
    })

    const { tree, typeModule } = parseEnvironment(build, values, tokens, moduleManager, new ParserScope({ parent: rootScope }))

    return { tree, typeModule, callables: build.callables, imports: build.imports, exports: build.exports }
}