import * as fs from 'fs';
import path from 'path';

import llvm from 'llvm-bindings';

import LLVMModule from './llvm-module';
import { lex } from '../lexer';
import { Context, declareFunction, defineFunction, parseStatements } from './compiler';
import { parseToTree } from '../parser';
import { ModuleManager } from '../modules';
import Logger from '../util/logger';
import TypeCheck from '../util/TypeCheck';

type Options = {
    output?: string
}

export function generateModule(work_dir: string, file_name: string, moduleManager: ModuleManager, LOGGER: Logger, options: Options) {

    // read the file
    LOGGER.info(`Reading file ${file_name}`);
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    // lex the file
    LOGGER.info(`Lexing file ${file_name}`);
    const tokens = lex(content, LOGGER)

    LOGGER.log(`Found ${tokens.length} tokens`)
    
    // get ast
    LOGGER.info(`Parsing file ${file_name}`);
    const { tree, callables, imports, exports } = parseToTree(moduleManager, tokens);

    LOGGER.log(`Found ${tree.length} statements`);

    // start compiler
    LOGGER.info(`Starting compiler`);

    const moduleName = file_name.split('.')[0];
    const module = new LLVMModule(moduleName);
    const builder = module.builder;

    const functionType = llvm.FunctionType.get(module.Types.int, [], false);
    const _init_func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.InternalLinkage, '_init', module._module);

    const context = new Context(_init_func);

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
    const entryBB = llvm.BasicBlock.Create(module._context, 'entry', _init_func);
    builder.SetInsertPoint(entryBB);

    // built in functions
    const printfType = llvm.FunctionType.get(module.Types.void, [module.Types.string], true);
    const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);
    context.set('printf', printf);

    // currently disabled
    // parseStatements(module, context, tree);

    // end of main function block
    builder.CreateRet(module.Values.int(0));
    builder.ClearInsertionPoint();

    // check if output exists
    const output = path.join(options.output || './', moduleName);
    if(!fs.existsSync(output)) fs.mkdirSync(output, { recursive: true });
    else if(!fs.lstatSync(output).isDirectory()) throw new Error(`Output path ${output} is not a directory`);

    // generate object file
    module.generateObject(path.join(output, moduleName));

    // generate ace.bindings file
    const lines: string[] = []
    for(const _export of exports) {
        lines.push(`declare ${TypeCheck.stringify(_export.returnType)} ${_export.name}(${_export.params.map(param => `${TypeCheck.stringify(param)}`).join(', ')})`);
    }
    fs.writeFileSync(path.join(output, 'ace.bindings'), lines.join('\n'));
}