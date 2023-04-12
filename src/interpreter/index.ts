import * as fs from 'fs';
import path from 'path';
import { lex } from '../lexer';
import { parseToTree } from '../parser';
import Logger from '../util/logger';
import Runtime from './runtime';
import { ModuleManager, initModuleManager } from '../modules';

export default async function interpret(work_dir: string, file_name: string, moduleManager: ModuleManager, LOGGER: Logger) {

    // read the file
    LOGGER.log(`Reading file ${file_name}`, { type: 'info', detail: 1 });
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    // lex the file
    LOGGER.log(`Lexing file ${file_name}`), { type: 'info', detail: 1 };
    const tokens = lex(content, LOGGER)

    LOGGER.log(`Found ${tokens.length} tokens`, { detail: 1 })

    // get ast
    LOGGER.log(`Parsing file ${file_name}`, { type: 'info', detail: 1 });
    const { tree } = parseToTree(moduleManager, tokens);

    LOGGER.log(`Found ${tree.length} statements`, { detail: 1 });

    // start runtime
    LOGGER.log(`Starting runtime`, { type: 'info', detail: 1 });
    const runtime = new Runtime();
    await runtime.init();

    // run the code
    await runtime.run({
        statements: tree
    });
}