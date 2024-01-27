import llvm from "llvm-bindings";
import LLVMModule from "./llvm-module";
import { FloatType, Int32Type, Int64Type, IntType, NumberType, Type } from "./types";
import { Field } from "./parser/util";

const valueTraits = ['Copyable'] as const
type ValueTrait = typeof valueTraits[number]

export abstract class Value {

    constructor(protected readonly traits: ValueTrait[] = []) {}

    public abstract toLLVM(module: LLVMModule): llvm.Value

    public implements(...traits: ValueTrait[]): boolean {
        return traits.every(trait => this.traits.includes(trait));
    }
}

export abstract class TypedValue<T extends Type = Type> extends Value {
    public abstract get type(): T;
}

export abstract class PrimitiveValue<T extends Type> extends TypedValue<T> {
    constructor() {
        super(['Copyable'])
    }
}

export abstract class NumberValue<T extends NumberType> extends TypedValue<T> {
    constructor(protected readonly value: number) {
        super();
    }
}

export abstract class IntValue<T extends IntType> extends NumberValue<T> {}

export class Int32Value extends IntValue<Int32Type> {
    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.getInt32(this.value);
    }

    public get type(): Type {
        return new Int32Type()
    }
}

export class Int64Value extends IntValue<Int64Type> {
    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.getInt64(this.value);
    }

    public get type(): Type {
        return new Int64Type()
    }
}

export class FloatValue extends NumberValue<FloatType> {
    public toLLVM(module: LLVMModule): llvm.Value {
        const constantFP = llvm.ConstantFP.get(module.builder.getFloatTy(), this.value);
        return module.builder.CreateFPCast(constantFP, module.builder.getFloatTy()); 
    }

    public get type(): Type {
        return new FloatType()
    }
}

export abstract class OperatorValue<T extends Type> extends TypedValue {
    constructor(protected readonly _type: T) {
        super();
    }

    public get type(): Type {
        return this._type;
    }
}

export abstract class UnaryOperatorValue<T extends Type> extends OperatorValue<T> {

    constructor(protected readonly right: TypedValue<T>, type?: T) {
        super(type ?? right.type);
        this.right = right;
    }
}
export abstract class BinaryOperatorValue<T extends Type> extends UnaryOperatorValue<T> {
    constructor(protected readonly left: TypedValue<T>, right: TypedValue<T>) {
        super(right, left.type);
    }
}

export class AddOperatorValue<T extends (NumberType)> extends BinaryOperatorValue<T> {
    public toLLVM(module: LLVMModule): llvm.Value {
        if(this.left.type instanceof IntType) {
            if(!this.left.type.matches(this.left.type)) throw new SyntaxError(`Cannot add ${this.left.type} and ${this.right.type}`);
            return module.builder.CreateAdd(this.left.toLLVM(module), this.right.toLLVM(module));
        }
        if(this.left.type instanceof FloatType) {
            if(!this.left.type.matches(this.left.type)) throw new SyntaxError(`Cannot add ${this.left.type} and ${this.right.type}`);
            return module.builder.CreateFAdd(this.left.toLLVM(module), this.right.toLLVM(module));
        }
        throw new SyntaxError(`Cannot add ${this.left.type} and ${this.right.type}`);
    }
}

export class ReferenceValue extends TypedValue {

    constructor(public readonly field: Field) {
        super();
    }

    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.CreateLoad(this.type.toLLVM(module), this.field.ptr);
    }

    public get type(): Type {
        return this.field.type;
    }
}