import { ModuleManager } from "./modules";
import { parseEnvironment } from "./parser/env";
import { Token, Types, Build, Value, Callable, ParserScope, StringType, VoidType, CallableType, IntType, FloatType, BooleanType, UnknownType, Wrappers } from "./types";
import Values from "./values";

export function parseToTree(moduleManager: ModuleManager, tokens: Token[][], values: Values) {

    const defaultTypes: Types = {
        string: new StringType(),
        int: new IntType(),
        float: new FloatType(),
        boolean: new BooleanType(),
        void: new VoidType(),
    }

    // built in functions
    const printfFunction: Callable = {
        name: 'printf',
        params: [
            {
                name: 'format',
                type: new StringType(),
            },
            {
                name: 'value',
                type: new UnknownType(),
            }
        ],
        returnType: new VoidType(),
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
        globals: {}
    }

    const rootScope = new ParserScope({ isRoot: true })
    rootScope.setGlobal('printf', {
        type: new CallableType(printfFunction.params.map(param => param.type), printfFunction.returnType)
    })

    const rootWrappers: Wrappers = {
        current: {}
    }

    const { tree, typeModule } = parseEnvironment(build, values, tokens, rootWrappers, moduleManager, new ParserScope({ parent: rootScope }))

    return { tree, typeModule, callables: build.callables, imports: build.imports, exports: build.exports, globals: build.globals }
}