import llvm from "llvm-bindings";
import LLVMModule from "../../llvm-module";
import { FunctionField, Statement } from "../util";

export abstract class FunctionStatement extends Statement {

    constructor(
        private readonly field: FunctionField,
    ) {
        super();
    }

    public compile(module: LLVMModule): void {
        const prevInsertionPoint = module.builder.GetInsertBlock();

        const func = this.field.allocate(module);
        const entry = llvm.BasicBlock.Create(module.context, 'entry', func);
        module.builder.SetInsertPoint(entry);

        this.compileBody(module, func);

        if(prevInsertionPoint) module.builder.SetInsertPoint(prevInsertionPoint);
        else module.builder.ClearInsertionPoint();
    }

    protected abstract compileBody(module: LLVMModule, self: llvm.Function): void;
}