import { KeywordToken, Token } from "../../lexer/tokens";
import { Environment, Statement } from "../util";
import ConstStatementParser from "./const";
import VarStatementParser from "./var";

export default function parseStatement(keyword: KeywordToken, tokens: Token[], env: Environment): Statement {
    switch(keyword.keyword) {
        case 'const': return new ConstStatementParser(tokens, env).parse();
        case 'var': return new VarStatementParser(tokens, env).parse();
    }
    throw new SyntaxError(`Unexpected keyword ${keyword.keyword}`);
}