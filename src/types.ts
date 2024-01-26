import llvm from "llvm-bindings";
import LLVMModule from "./llvm-module";

export abstract class Type {
    public abstract toLLVM(module: LLVMModule): llvm.Type
    public abstract matches(other: Type): boolean
    public abstract toString(): string
}

export abstract class NumberType extends Type {}

export abstract class IntType extends NumberType {}

export class Int32Type extends IntType {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt32Ty();
    }

    public matches(other: Type): boolean {
        return other instanceof Int32Type;
    }

    public toString(): string {
        return 'i32';
    }
}

export class Int64Type extends IntType {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt64Ty();
    }

    public matches(other: Type): boolean {
        return other instanceof Int64Type;
    }

    public toString(): string {
        return 'i64';
    }
}

export class FloatType extends NumberType {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getFloatTy();
    }

    public matches(other: Type): boolean {
        return other instanceof FloatType;
    }

    public toString(): string {
        return 'float';
    }
}

export class VoidType extends Type {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getVoidTy();
    }

    public matches(other: Type): boolean {
        return other instanceof VoidType;
    }

    public toString(): string {
        return 'void';
    }
}