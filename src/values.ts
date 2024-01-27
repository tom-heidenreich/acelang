import llvm from "llvm-bindings";
import LLVMModule from "./llvm-module";
import { FloatType, Int32Type, Int64Type, IntType, NumberType, Type, VoidType } from "./types";
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

export abstract class OperatorValue extends TypedValue {}

export abstract class UnaryOperatorValue<T extends TypedValue = TypedValue> extends OperatorValue {

    constructor(protected readonly right: T) {
        super();
        this.right = right;
    }
}
export abstract class BinaryOperatorValue<T extends TypedValue = TypedValue, E extends TypedValue = TypedValue> extends UnaryOperatorValue<E> {
    constructor(protected readonly left: T, right: E) {
        super(right);
    }
}

export abstract class AddOperatorValue<T extends (NumberType) = NumberType> extends BinaryOperatorValue<TypedValue<T>, TypedValue<T>> {}

export class IntAddOperatorValue extends AddOperatorValue<IntType> {
    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.CreateAdd(this.left.toLLVM(module), this.right.toLLVM(module));
    }

    public get type(): Type {
        return this.left.type;
    }
}

export class AssignOperatorValue extends BinaryOperatorValue<ReferenceValue> {

    constructor(left: ReferenceValue, right: TypedValue) {
        super(left, right);
    }

    public toLLVM(module: LLVMModule): llvm.Value {
        return module.builder.CreateStore(this.right.toLLVM(module), this.left.field.ptr);
    }

    public get type(): Type {
        return new VoidType();
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