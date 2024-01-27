import llvm from "llvm-bindings";
import LLVMModule from "./llvm-module";

export abstract class Type {
    public abstract toLLVM(module: LLVMModule): llvm.Type

    public matches(other: Type): boolean {
        if(other instanceof OptionalType && other.isResolved) return this.matches(other.type);
        return this._matches(other);
    }

    public abstract _matches(other: Type): boolean

    public abstract toString(): string
}

export abstract class NumberType extends Type {}

export abstract class IntType extends NumberType {}

export class Int32Type extends IntType {
    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt32Ty();
    }

    public _matches(other: Type): boolean {
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

    public _matches(other: Type): boolean {
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

    public _matches(other: Type): boolean {
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

    public _matches(other: Type): boolean {
        return other instanceof VoidType;
    }

    public toString(): string {
        return 'void';
    }
}

export class OptionalType extends Type {

    private _isResolved: boolean = false;

    constructor(public readonly type: Type) {
        super();
    }

    public toLLVM(module: LLVMModule): llvm.Type {
        if(!this._isResolved) throw new Error('Optional type has not been resolved and cannot be compiled');
        return this.type.toLLVM(module)
    }

    public _matches(other: Type): boolean {
        return other.matches(this.type) || (other instanceof OptionalType && other.type.matches(this.type));
    }

    public resolveBy(type: Type): void {
        if(type instanceof OptionalType) this._isResolved = false
        else this._isResolved = true;
    }

    public get isResolved(): boolean {
        return this._isResolved;
    }

    public toString(): string {
        return `${this.type}?`;
    }
}