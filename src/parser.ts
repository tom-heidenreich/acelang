import { ModuleManager } from "./modules";
import { parseEnvironment } from "./parser/env";
import { Token, DATATYPES, Types, Build, Value, Callable } from "./types";

export function parseToTree(moduleManager: ModuleManager, tokens: Token[][]) {

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
        isSync: true,
        isBuiltIn: true,
    }
    
    const build: Build = {
        types: defaultTypes,
        callables: {
            printf: printfFunction
        },
        imports: [],
    }

    const { tree, typeModule } = parseEnvironment(build, tokens, moduleManager, {
        fields: {
            local: {},
            parent: {
                local: {
                    printf: {
                        type: {
                            type: 'callable',
                            params: printfFunction.params.map(param => param.type),
                            returnType: printfFunction.returnType,
                        }
                    }
                },
            }
        },
    })

    return { tree, typeModule, callables: build.callables, imports: build.imports }
}