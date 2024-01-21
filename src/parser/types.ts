import llvm from "llvm-bindings";
import LLVMModule from "../llvm-module";

export abstract class Type {
    public abstract toLLVM(module: LLVMModule): llvm.Type
}

export class Int32Type extends Type {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt32Ty();
    }
}

export class Int64Type extends Type {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt64Ty();
    }
}

export class FloatType extends Type {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getFloatTy();
    }
}