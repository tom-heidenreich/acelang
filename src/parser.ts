import { ModuleManager } from "./modules";
import { parseEnvironment } from "./parser/env";
import { Token, Types, Build, Value, Callable, ParserScope, StringType, AnyType, VoidType, CallableType, IntType, FloatType, BooleanType } from "./types";
import Values from "./values";

export function parseToTree(moduleManager: ModuleManager, tokens: Token[][], values: Values) {

    const defaultTypes: Types = {
        string: new StringType(),
        int: new IntType(),
        float: new FloatType(),
        boolean: new BooleanType(),
        void: new VoidType(),
        any: new AnyType(),
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
                type: new AnyType(),
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

    const { tree, typeModule } = parseEnvironment(build, values, tokens, moduleManager, new ParserScope({ parent: rootScope }))

    return { tree, typeModule, callables: build.callables, imports: build.imports, exports: build.exports, globals: build.globals }
}