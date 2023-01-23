import path from 'path';
import * as fs from 'fs';
import { parse } from './lexer';
import { parseToTree } from './parser';

// read the file
const content = fs.readFileSync(path.join(__dirname, '..', '..', 'index.ace'), 'utf8');

const tokens = parse(content)

fs.writeFileSync('./log/tokens.json', JSON.stringify(tokens, null, 4), 'utf8');

// get ast
const { tree, map } = parseToTree(tokens);

fs.writeFileSync('./log/parsed.json', JSON.stringify(tree, null, 4), 'utf8');

fs.writeFileSync('./log/type_map.json', JSON.stringify(map, null, 4), 'utf8');