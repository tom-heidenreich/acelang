import path from 'path';
import * as fs from 'fs';
import { parse } from './parser';
import { toBuildInstructions } from './instructions';

 // read the file
 const content = fs.readFileSync(path.join(__dirname, '..', '..', 'index.ace'), 'utf8');

const parsed = parse(content)

fs.writeFileSync('./log/parsed.json', JSON.stringify(parsed, null, 4), 'utf8');

// get instructions
const instructions = toBuildInstructions(parsed);

console.log(instructions);
fs.writeFileSync('./log/instructions.json', JSON.stringify(instructions, null, 4), 'utf8');