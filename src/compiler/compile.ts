import * as fs from 'fs';
import path from 'path';
import { lex } from '../lexer';
import { parseToTree } from '../parser';

export default function compile(work_dir: string, file_name: string) {

    // read the file
    const content = fs.readFileSync(path.join(work_dir, file_name), 'utf8');

    const tokens = lex(content)

    fs.writeFileSync('./log/tokens.json', JSON.stringify(tokens, null, 4), 'utf8');

    // get ast
    const { tree, typeModule } = parseToTree(tokens);

    fs.writeFileSync('./log/parsed.json', JSON.stringify(tree, null, 4), 'utf8');

    fs.writeFileSync('./log/module.json', JSON.stringify(typeModule, null, 4), 'utf8');
}