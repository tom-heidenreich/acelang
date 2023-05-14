import llvm from 'llvm-bindings';
import { BooleanType, FloatType, IntType, StringType, Type, Types as TypeMap, VoidType, ArrayType, StructType } from '../types';
import LLVMModule from './llvm-module';

export type Types = {
    int: llvm.Type;
    float: llvm.Type;
    string: llvm.Type;
    bool: llvm.Type;
    void: llvm.Type;
    array: (type: Type, size: number) => llvm.ArrayType;
    struct: (types: TypeMap) => llvm.StructType;
}

export function getTypes(module: LLVMModule): Types {
    return {
        int: new IntType().toLLVM(module),
        float: new FloatType().toLLVM(module),
        string: new StringType().toLLVM(module),
        bool: new BooleanType().toLLVM(module),
        void: new VoidType().toLLVM(module),
        array: (type: Type, size: number) => new ArrayType(type, size).toLLVM(module),
        struct: (types: TypeMap) => new StructType(types).toLLVM(module),
    }
}

export type Values = {
    int: (value: number) => llvm.Value;
    float: (value: number) => llvm.Value;
    string: (value: string) => llvm.Value;
    bool: (value: boolean) => llvm.Value;
    undefined: (type: llvm.Type) => llvm.Value;
    null: (type: llvm.Type) => llvm.Constant;
    void: () => llvm.Value;
}

export function getValues(builder: llvm.IRBuilder, context: llvm.LLVMContext): Values {
    return {
        int: (value: number) => builder.getInt32(value),
        float: (value: number) => {
            // use ConstantFP
            const constantFP = llvm.ConstantFP.get(builder.getDoubleTy(), value);
            return builder.CreateFPCast(constantFP, builder.getDoubleTy()); 
        },
        string: (value: string) => builder.CreateGlobalStringPtr(value),
        bool: (value: boolean) => builder.getInt1(value),
        undefined: (type: llvm.Type) => llvm.UndefValue.get(type),
        null: (type: llvm.Type) => llvm.Constant.getNullValue(type),
        void: () => llvm.UndefValue.get(builder.getVoidTy()),
    };
}