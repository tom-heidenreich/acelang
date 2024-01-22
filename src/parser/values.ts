import llvm from "llvm-bindings";
import LLVMModule from "../llvm-module";

export abstract class Value {
    public abstract toLLVM(module: LLVMModule): llvm.Value
}

export abstract class NumberValue extends Value {
    constructor(protected readonly value: number) {
        super();
    }
}

export class Int32Value extends NumberValue {
    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.getInt32(this.value);
    }
}

export class Int64Value extends NumberValue {
    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.getInt64(this.value);
    }
}

export class FloatValue extends NumberValue {
    public toLLVM(module: LLVMModule): llvm.Value {
        const constantFP = llvm.ConstantFP.get(module.builder.getFloatTy(), this.value);
        return module.builder.CreateFPCast(constantFP, module.builder.getFloatTy()); 
    }
}