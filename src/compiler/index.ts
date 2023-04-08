import llvm from "llvm-bindings";

import LLVMModule from "./llvm-module";

import * as fs from 'fs';
import path from 'path';
import { lex } from "../lexer";
import { parseToTree } from "../parser";
import Logger from "../util/logger";
import { Statement, Value, VariableDeclaration } from "../types";

type CompilerOptions = {
    output?: string
    execute?: boolean
}

export default async function compile(work_dir: string, file_name: string, LOGGER: Logger, options: CompilerOptions) {

    // read the file
    LOGGER.info(`Reading file ${file_name}`);
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    // lex the file
    LOGGER.info(`Lexing file ${file_name}`);
    const tokens = lex(content, LOGGER)

    LOGGER.log(`Found ${tokens.length} tokens`)

    // get ast
    LOGGER.info(`Parsing file ${file_name}`);
    const { tree } = parseToTree(tokens);

    LOGGER.log(`Found ${tree.length} statements`);

    // start compiler
    LOGGER.info(`Starting compiler`);

    const fileNameWithoutExtension = file_name.split('.').slice(0, -1).join('.');

    const module = new LLVMModule(fileNameWithoutExtension);
    const builder = module.builder;

    builder.ClearInsertionPoint();

    module.createMain();

    const context = new Context();

    // built in functions
    const printfType = llvm.FunctionType.get(module.Types.void, [module.Types.string], true);
    const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);
    context.set('printf', printf);

    parseStatements(module, context, tree);

    module.exitMain();

    module.verify();
    if(options.execute) await module.executeJIT(options.output, 'inherit');
    module.generateExecutable(options.output, 'inherit');
}

function parseStatements(module: LLVMModule, context: Context, statements: Statement[]): void {
    if(statements.length === 1) {
        const statement = statements[0];
        if(statement.type === 'multiStatement') return parseStatements(module, context, statement.statements);
        switch(statement.type) {
            case 'expressionStatement': {
                compileValue(module, context, statement.expression);
                return;
            }
            case 'variableDeclaration': return parseVariableDeclaration(statement, module, context);
        }
        throw new Error(`Unknown statement type ${statement.type}`);
    }
    for(const statement of statements) {
        parseStatements(module, context, [statement]);
    }
}

class Context {

    private values: Map<string, llvm.Value>;
    private parent?: Context

    constructor() {
        this.values = new Map();
    }

    public set(name: string, value: llvm.Value) {
        this.values.set(name, value);
    }

    public get(name: string): llvm.Value | undefined {
        if(this.values.has(name)) return this.values.get(name);
        if(this.parent) return this.parent.get(name);
        return undefined;
    }
}

function compileValue(module: LLVMModule, context: Context, value: Value): llvm.Value {
    switch(value.type) {
        case 'literal': {
            switch(value.literalType) {
                case 'int': return module.Values.int(value.literal as number);
                case 'float': return module.Values.float(value.literal as number);
                case 'string': return module.Values.string(value.literal as string);
                case 'boolean': return module.Values.bool(value.literal as boolean);
            }
        }
        case 'reference': {
            const ref = context.get(value.reference);
            if(!ref) throw new Error(`Unknown reference ${value.reference}`);
            return ref;
        }
        case 'dereference': {
            const target = compileValue(module, context, value.target);
            return module.builder.CreateLoad(target.getType().getPointerElementType(), target)
        }
        case 'call': {
            const argValues = value.args.map(arg => compileValue(module, context, arg));
            const callable = compileValue(module, context, value.callable);
            if(callable instanceof llvm.Function) return module.builder.CreateCall(callable, argValues);
            throw new Error(`Unknown callable type ${value.callable.type}`);
        }
        case 'assign': {
            const target = compileValue(module, context, value.target);
            const assignValue = compileValue(module, context, value.value);
            return module.builder.CreateStore(assignValue, target);
        }
        case 'add': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateAdd(left, right);
        }
        case 'subtract': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateSub(left, right);
        }
        case 'multiply': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateMul(left, right);
        }
        case 'divide': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateSDiv(left, right);
        }
    }
    throw new Error(`Unknown value type ${value.type}`);
}

function parseVariableDeclaration(statement: VariableDeclaration, module: LLVMModule, context: Context): void {
    const { name, value, valueType } = statement;

    let compiledValue: llvm.Value | undefined;
    if(value) compiledValue = compileValue(module, context, value);

    const type = module.Types.convertType(valueType)
    const _var = module.builder.CreateAlloca(type);
    context.set(name, _var);

    if(compiledValue) {
        module.builder.CreateStore(compiledValue, _var);
    }
}