import * as fs from 'fs';
import { Lexer } from './lexer';
import { INITIAL_STATE } from './lexer/states';

// get file path from command line arguments
const filePath = process.argv[2];
if(!filePath) {
    console.error('No file path provided');
    process.exit(1);
}

// read file
const file = fs.readFileSync(filePath, 'utf8');

// tokenize
const lexer = new Lexer(INITIAL_STATE);
const tokens = lexer.tokenize(file);

fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/tokens.json', JSON.stringify(tokens, undefined, 4));