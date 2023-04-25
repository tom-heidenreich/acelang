import * as fs from 'fs';
import path from 'path';

import llvm from 'llvm-bindings';

import LLVMModule from './llvm-module';
import Lexer from '../lexer';
import { Scope, declareFunction, defineFunction, parseStatements } from './compiler';
import { parseToTree } from '../parser';
import { ModuleManager } from '../modules';
import Logger from '../util/logger';
import TypeCheck from '../util/TypeCheck';
import Values from '../values';

type Options = {
    output?: string
}

export function generateModule(work_dir: string, file_name: string, moduleManager: ModuleManager, LOGGER: Logger, options: Options) {

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
    const { tree, callables, imports, exports } = parseToTree(moduleManager, tokens, values);

    LOGGER.log(`Found ${tree.length} statements`, { detail: 1 });

    // start compiler
    LOGGER.log(`Starting compiler`, { type: 'info', detail: 1 });

    const moduleName = file_name.split('.')[0];
    const module = new LLVMModule(moduleName);
    const builder = module.builder;

    const functionType = llvm.FunctionType.get(module.Types.int, [], false);
    const _init_func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.InternalLinkage, '_init', module._module);

    const scope = new Scope(_init_func);

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
    const entryBB = llvm.BasicBlock.Create(module._context, 'entry', _init_func);
    builder.SetInsertPoint(entryBB);

    // built in functions
    const printfType = llvm.FunctionType.get(module.Types.void, [module.Types.string], true);
    const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);
    scope.set('printf', printf);

    // currently disabled
    // parseStatements(module, scope, tree);

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