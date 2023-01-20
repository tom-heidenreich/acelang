import { parseEnvironment } from "./parser/env";
import { Token, DATATYPES, Types, Build } from "./types";

export function parseToTree(tokens: Token[][]) {

    const defaultTypes: Types = {}
    for (const type of DATATYPES) {
        defaultTypes[type] = {
            type: 'primitive',
            primitive: type,
        }
    }
    
    const build: Build = {
        types: defaultTypes,
        callables: {
            // built in functions
            print: {
                isSync: true,
                body: [],
            },
            wait: {
                isSync: true,
                body: [],
            }
        },
    }

    const { tree, env } = parseEnvironment(build, tokens, {
        fields: {
            local: {},
            parent: {
                local: {
                    print: {
                        type: {
                            type: 'callable',
                            params: [{
                                type: 'primitive',
                                primitive: 'any',
                            }],
                            returnType: {
                                type: 'primitive',
                                primitive: 'void',
                            },
                        }
                    },
                    wait: {
                        type: {
                            type: 'callable',
                            params: [{
                                type: 'primitive',
                                primitive: 'int',
                            }],
                            returnType: {
                                type: 'primitive',
                                primitive: 'void',
                            },
                        }
                    }
                },
            }
        },
    })

    return { tree, map: {
        types: build.types,
        fields: env.fields.local,
    } }
}