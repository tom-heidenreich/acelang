import llvm from "llvm-bindings";

import LLVMModule from "./llvm-module";

import * as fs from 'fs';
import path from 'path';
import { lex } from "../lexer";
import { parseToTree } from "../parser";
import Logger from "../util/logger";
import { ModuleManager } from "../modules";
import { Context, declareFunction, defineFunction, parseStatements } from "./compiler";

type CompilerOptions = {
    output?: string
    execute?: boolean
}

export default async function compile(work_dir: string, file_name: string, moduleManager: ModuleManager, LOGGER: Logger, options: CompilerOptions) {

    // read the file
    LOGGER.info(`Reading file ${file_name}`);
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    // lex the file
    LOGGER.info(`Lexing file ${file_name}`);
    const tokens = lex(content, LOGGER)

    LOGGER.log(`Found ${tokens.length} tokens`)
    
    // get ast
    LOGGER.info(`Parsing file ${file_name}`);
    const { tree, callables, imports } = parseToTree(moduleManager, tokens);

    LOGGER.log(`Found ${tree.length} statements`);

    // start compiler
    LOGGER.info(`Starting compiler`);

    const module = new LLVMModule(moduleManager.name);
    const builder = module.builder;

    const mainFunc = module.createMain();
    const context = new Context(mainFunc);

    // declare imports
    for(const _import of imports) {
        if(_import.type !== 'function') throw new Error('Only function imports are supported');
        declareFunction(module, context, _import);
    }

    // declare functions
    for(const callableName in callables) {
        defineFunction(module, context, callables[callableName], callableName)
    }

    // start of main function block
    const entryBB = llvm.BasicBlock.Create(module._context, 'entry', mainFunc);
    builder.SetInsertPoint(entryBB);

    // built in functions
    const printfType = llvm.FunctionType.get(module.Types.void, [module.Types.string], true);
    const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);
    context.set('printf', printf);

    parseStatements(module, context, tree);

    // end of main function block
    module.exitMain();

    module.verify();
    if(options.execute) {
        if(moduleManager.getLinkedFiles().length > 0) throw new Error('Cannot execute a module with linked files currently');
        await module.executeJIT(options.output, 'inherit');
    }
    
    module.generateExecutable(options.output, moduleManager.getLinkedFiles(), 'inherit');
}