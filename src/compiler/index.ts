import llvm from "llvm-bindings";

import LLVMModule from "./llvm-module";

import * as fs from 'fs';
import path from 'path';
import Lexer from "../lexer";
import { parseToTree } from "../parser";
import Logger from "../util/logger";
import { ModuleManager } from "../modules";
import { Scope, declareFunction, defineFunction, defineGlobal, parseStatements } from "./compiler";
import Values from "../values";

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
    const values = new Values()
    const { tree, callables, imports, globals } = parseToTree(moduleManager, tokens, values);

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

    const mallocType = llvm.FunctionType.get(module.builder.getInt8PtrTy(), [module.builder.getInt64Ty()], true);
    const malloc = llvm.Function.Create(mallocType, llvm.Function.LinkageTypes.ExternalLinkage, 'malloc', module._module);
    scope.set('malloc', malloc);

    const freeType = llvm.FunctionType.get(module.Types.void, [module.builder.getInt8PtrTy()], true);
    const free = llvm.Function.Create(freeType, llvm.Function.LinkageTypes.ExternalLinkage, 'free', module._module);
    scope.set('free', free);

    // declare imports
    for(const _import of imports) {
        if(_import.type !== 'function') throw new Error('Only function imports are supported');
        declareFunction(module, scope, _import);
    }

    // declare globals
    for(const globalName in globals) {
        defineGlobal(module, scope, globals[globalName], globalName);
    }

    // declare functions
    for(const callableName in callables) {
        const callable = callables[callableName]
        defineFunction(module, scope, callable, callable.name)
    }

    // start of main function block
    const entryBB = llvm.BasicBlock.Create(module._context, 'entry', mainFunc);
    
    // default catch block
    const catchBlock = llvm.BasicBlock.Create(module._context, 'catch.default', mainFunc);
    builder.SetInsertPoint(catchBlock);
    builder.CreateCall(printf, [module.builder.CreateGlobalStringPtr('Exception thrown!\n')]);
    builder.CreateRet(module.Values.int(1));
    
    // function body
    const bodyBlock = llvm.BasicBlock.Create(module._context, 'body', mainFunc);
    builder.SetInsertPoint(entryBB);
    builder.CreateBr(bodyBlock);
    builder.SetInsertPoint(bodyBlock);

    // main scope
    const mainScope = new Scope(mainFunc, scope, {
        catch: catchBlock
    });

    const exceptionFlag = module.createExceptionFlag();
    mainScope.set('%exception', exceptionFlag)

    parseStatements(module, mainScope, tree);

    // end of main function block
    module.exitMain();

    module.verify();
    
    await module.generateExecutable(options.output, moduleManager.getLinkedFiles(), 'inherit');

    if(options.execute) {
        if(moduleManager.getLinkedFiles().length > 0) await module.runExecutable(options.output, 'inherit')
        else await module.executeJIT(options.output, 'inherit');
    }
}