import { parseEnvironment } from "./parser/env";
import { Token, DATATYPES, Types, Build, Value } from "./types";

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
            time: {
                isSync: true,
                body: [],
            },
            wait: {
                isSync: true,
                body: [],
            }
        },
    }

    const { tree, typeModule } = parseEnvironment(build, tokens, {
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
                    time: {
                        type: {
                            type: 'callable',
                            params: [],
                            returnType: {
                                type: 'primitive',
                                primitive: 'int',
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

    return { tree, typeModule }
}