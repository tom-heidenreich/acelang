import { KeywordToken, Token } from "../lexer/tokens";
import ExpressionParser from "./expressions";
import parseStatement from "./statements";
import { ExpressionNode, StatementNode, SyntaxNode } from "./ast";
import { Environment } from "./util";

export default function parse(tokens: Token[][], env: Environment = new Environment()): SyntaxNode[] {
    const statements: SyntaxNode[] = [];
    for(const line of tokens) {
        statements.push(parseLine(line, env));
    }
    return statements;
}

function parseLine(tokens: Token[], env: Environment): SyntaxNode {
    if(tokens.length === 0) throw new Error('No tokens provided')
    const first = tokens[0];
    if(first instanceof KeywordToken) return new StatementNode(parseStatement(first, tokens.slice(1), env));
    return new ExpressionNode(new ExpressionParser(tokens, env).parse());
}