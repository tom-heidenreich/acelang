import { parseEnvironment } from "./parser/env";
import { Token, DATATYPES, Types, Build, Value, Callable } from "./types";

export function parseToTree(tokens: Token[][]) {

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
                type: 'primitive',
                primitive: 'string',
            },
            {
                type: 'primitive',
                primitive: 'any',
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
    }

    const { tree, typeModule } = parseEnvironment(build, tokens, {
        fields: {
            local: {},
            parent: {
                local: {
                    printf: {
                        type: {
                            type: 'callable',
                            params: printfFunction.params,
                            returnType: printfFunction.returnType,
                        }
                    }
                },
            }
        },
    })

    return { tree, typeModule, callables: build.callables }
}