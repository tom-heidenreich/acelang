import path from 'path';
import * as fs from 'fs';
import { parse } from './parser';

 // read the file
 const content = fs.readFileSync(path.join(__dirname, '..', '..', 'index.ace'), 'utf8');

const parsed = parse(content)
console.log(parsed);

fs.writeFileSync('./parsed.json', JSON.stringify(parsed, null, 4), 'utf8');