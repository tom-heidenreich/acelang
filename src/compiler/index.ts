import llvm from "llvm-bindings";

import LLVMModule from "./llvm-module";

import * as fs from 'fs';
import path from 'path';
import Lexer from "../lexer";
import { parseToTree } from "../parser";
import Logger from "../util/logger";
import { ModuleManager } from "../modules";
import { Scope, declareFunction, defineFunction, parseStatements } from "./compiler";

type CompilerOptions = {
    output?: string
    execute?: boolean
    noStackProbes?: boolean
}

export default async function compile(work_dir: string, file_name: string, moduleManager: ModuleManager, LOGGER: Logger, options: CompilerOptions) {

    // read the file
    LOGGER.log(`Reading file ${file_name}`, { type: 'info', detail: 1 });
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    // lex the file
    LOGGER.log(`Lexing file ${file_name}`, { type: 'info', detail: 1 });
    const lexer = new Lexer(path.join(work_dir, file_name))
    const tokens = lexer.lex(content)

    LOGGER.log(`Found ${tokens.length} tokens`, { detail: 1 })
    
    // get ast
    LOGGER.log(`Parsing file ${file_name}`, { type: 'info', detail: 1 });
    const { tree, callables, imports } = parseToTree(moduleManager, tokens);

    LOGGER.log(`Found ${tree.length} statements`, {detail: 1 });

    // start compiler
    LOGGER.log(`Starting compiler`, { type: 'info', detail: 1 });

    const module = new LLVMModule(moduleManager.name);
    const builder = module.builder;

    const mainFunc = module.createMain();
    const scope = new Scope(mainFunc);

    if(options.noStackProbes) module.disableStackProbes();

    // built in functions
    const printfType = llvm.FunctionType.get(module.Types.void, [module.Types.string], true);
    const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);
    scope.set('printf', printf);

    // declare imports
    for(const _import of imports) {
        if(_import.type !== 'function') throw new Error('Only function imports are supported');
        declareFunction(module, scope, _import);
    }

    // declare functions
    for(const callableName in callables) {
        defineFunction(module, scope, callables[callableName], callableName)
    }

    // start of main function block
    const entryBB = llvm.BasicBlock.Create(module._context, 'entry', mainFunc);
    builder.SetInsertPoint(entryBB);

    parseStatements(module, scope, tree);

    // end of main function block
    module.exitMain();

    module.verify();
    
    await module.generateExecutable(options.output, moduleManager.getLinkedFiles(), 'inherit');

    if(options.execute) {
        if(moduleManager.getLinkedFiles().length > 0) await module.runExecutable(options.output, 'inherit')
        else await module.executeJIT(options.output, 'inherit');
    }
}