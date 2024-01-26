import { Value } from "../values";
import LLVMModule from "../llvm-module";
import { Statement } from "./util";

export abstract class SyntaxNode {
    public abstract compile(module: LLVMModule): void
}

export class ExpressionNode extends SyntaxNode {
    constructor(
        public value: Value,
    ) {
        super();
    }

    public compile(module: LLVMModule): void {
        this.value.toLLVM(module);
    }
}

export class StatementNode extends SyntaxNode {
    constructor(
        public statement: Statement,
    ) {
        super();
    }

    public compile(module: LLVMModule): void {
        return this.statement.compile(module);
    }
}