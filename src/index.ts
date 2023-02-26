import path from 'path';
import * as fs from 'fs';
import { lex } from './lexer';
import { parseToTree } from './parser';

process.env.FILE_EXTENSION = 'ace';
process.env.WORK_DIR = path.join(__dirname, '..', '..')

// read the file
const content = fs.readFileSync(path.join(process.env.WORK_DIR, 'index.ace'), 'utf8');

const tokens = lex(content)

fs.writeFileSync('./log/tokens.json', JSON.stringify(tokens, null, 4), 'utf8');

// get ast
const { tree, typeModule } = parseToTree(tokens);

fs.writeFileSync('./log/parsed.json', JSON.stringify(tree, null, 4), 'utf8');

fs.writeFileSync('./log/module.json', JSON.stringify(typeModule, null, 4), 'utf8');