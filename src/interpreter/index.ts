import * as fs from 'fs';
import path from 'path';
import { lex } from '../lexer';
import { parseToTree } from '../parser';
import Logger from '../util/logger';
import Runtime from './runtime';

export default async function interpret(work_dir: string, file_name: string, LOGGER: Logger) {

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

    // start runtime
    LOGGER.info(`Starting runtime`);
    const runtime = new Runtime();
    await runtime.init();

    // run the code
    await runtime.run({
        statements: tree
    });
}