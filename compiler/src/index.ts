import path from 'path';
import * as fs from 'fs';
import { parse } from './parser';
import { buildAST } from './ast-builder';
import Runtime from './runtime';

 // read the file
 const content = fs.readFileSync(path.join(__dirname, '..', '..', 'index.ace'), 'utf8');

const parsed = parse(content)

fs.writeFileSync('./log/parsed.json', JSON.stringify(parsed, null, 4), 'utf8');

// get ast
const { ast, map } = buildAST(parsed);

fs.writeFileSync('./log/ast.json', JSON.stringify(ast, null, 4), 'utf8');

fs.writeFileSync('./log/type_map.json', JSON.stringify(map, null, 4), 'utf8');

// runtime
const runtime = new Runtime(ast);
runtime.run();