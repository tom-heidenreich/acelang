import { Token, TokenLine } from "../types";

export default function line(token: Token) {
    const line = token.lineInfo;
    if(line.line === line.endLine && line.char === line.endChar) {
        return `Ln ${line.line}, Col ${line.char}`
    }
    return `Ln ${line.line}, Col ${line.char} - Ln ${line.endLine}, Col ${line.endChar}`
}