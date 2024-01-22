import * as fs from 'fs';
import { Lexer } from './lexer';
import { INITIAL_STATE } from './lexer/states';
import parseExpression from './parser/expressions';
import LLVMModule from './llvm-module';
import llvm from 'llvm-bindings';
import { Int64Type } from './parser/types';

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

// parse
const value = parseExpression(tokens[0]);

// compile
const _module = new LLVMModule('my_module');

const mainFunction = _module.createMain();
_module.builder.SetInsertPoint(llvm.BasicBlock.Create(_module.context, 'entry', mainFunction));
_module.builder.CreateAlloca(new Int64Type().toLLVM(_module), value.toLLVM(_module));
_module.exitMain();

fs.writeFileSync('out/llvm.ll', _module.toString());