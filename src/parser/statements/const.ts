import { IdentifierToken, OperatorToken, SymbolToken } from "../../lexer/tokens";
import LLVMModule from "../../llvm-module";
import { TypedValue } from "../../values";
import parseType from "../types";
import { Type } from "../../types";
import { Field, Statement, StatementParser } from "../util";
import ExpressionParser from "../expressions";

export default class ConstStatementParser extends StatementParser {

    public parse(): Statement {
        
        // expect identifier
        const identifier = this.next;
        if(!(identifier instanceof IdentifierToken)) throw new SyntaxError(`Expected identifier, got ${identifier}`)

        let type: Type | undefined;

        // if ':' is next, parse type
        const colon = this.peek;
        if(colon instanceof SymbolToken && colon.symbol === ':') {
            this.next;
            type = parseType(this.until(token => token instanceof OperatorToken && token.operator === '='));
        }

        // expect '='
        const equals = this.next;
        if(!(equals instanceof OperatorToken)) throw new SyntaxError(`Expected operator, got ${equals}`)
        if(equals.operator !== '=') throw new SyntaxError(`Expected '=', got ${equals}`)

        // parse value
        const value = new ExpressionParser(this.remaining, this.env).parse();

        // check if types match
        if(type && !value.type.matches(type)) throw new SyntaxError(`Type mismatch: expected ${type}, got ${value.type}`)

        // add to environment
        const field = Field.from({
            type: type || value.type,
            identifier: identifier.identifier,
        })
        this.env.set(identifier.identifier, field);

        return new ConstStatement(field, value);
    }
}

export class ConstStatement extends Statement {

    constructor(
        private readonly field: Field,
        private readonly value: TypedValue
    ) {
        super();
    }

    public compile(module: LLVMModule): void {
        const alloca = this.field.allocate(module);
        module.builder.CreateStore(this.value.toLLVM(module), alloca);
    }
}