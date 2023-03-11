import * as fs from 'fs';
import path from 'path';
import { lex } from '../lexer';
import { parseToTree } from '../parser';
import Logger from '../util/logger';

export type InterpretOptions = {
    details?: number;
    log?: boolean;
    silent?: boolean;
    watch?: boolean;
}

export default function interpret(work_dir: string, file_name: string, LOGGER: Logger) {

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

    LOGGER.info(`Starting runtime`);
}