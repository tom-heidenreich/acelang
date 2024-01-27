import llvm from "llvm-bindings";
import LLVMModule from "./llvm-module";
import { FunctionStatement } from "./parser/statements/func";
import { FunctionField } from "./parser/util";
import { FunctionType, Int32Type, VoidType } from "./types";

const PrintIntType = new FunctionType(new VoidType(), [new Int32Type()])
const PrintIntField = FunctionField.from({
    type: PrintIntType,
    identifier: 'printInt',
})

class PrintIntFunctionStatement extends FunctionStatement {
    protected compileBody(module: LLVMModule, self: llvm.Function): void {
        const previousBlock = module.builder.GetInsertBlock();
        module.builder.ClearInsertionPoint();

        // declare printf
        const printfType = llvm.FunctionType.get(llvm.Type.getInt32Ty(module.context), [llvm.Type.getInt8PtrTy(module.context)], true);
        const printf = llvm.Function.Create(printfType, llvm.Function.LinkageTypes.ExternalLinkage, 'printf', module._module);

        if(!previousBlock) throw new Error('Unexpected empty previous insertion point');
        module.builder.SetInsertPoint(previousBlock);

        // get first argument
        const firstArg = self.getArg(0);

        // call printf
        const formatString = module.builder.CreateGlobalStringPtr('%d\n');
        module.builder.CreateCall(printf, [formatString, firstArg]);

        module.builder.CreateRetVoid();
    }
}
export const PrintIntFunction = {
    type: PrintIntType,
    field: PrintIntField,
    statement: new PrintIntFunctionStatement(PrintIntField),
}