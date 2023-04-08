import llvm from 'llvm-bindings';
import { Type } from '../types';

export type Types = {
    int: llvm.Type;
    float: llvm.Type;
    string: llvm.Type;
    bool: llvm.Type;
    void: llvm.Type;

    convertType: (type: Type) => llvm.Type;
    dereference: (type: Type) => llvm.Type;
}

export function getTypes(builder: llvm.IRBuilder): Types {

    const primitives = {
        int: builder.getInt64Ty(),
        float: builder.getDoubleTy(),
        string: builder.getInt8PtrTy(),
        bool: builder.getInt1Ty(),
        void: builder.getVoidTy()
    }

    const convertType = (type: Type): llvm.Type => {
        switch(type.type) {
            case 'primitive': {
                switch(type.primitive) {
                    case 'int': return primitives.int;
                    case 'float': return primitives.float;
                    case 'string': return primitives.string;
                    case 'boolean': return primitives.bool;
                    case 'void': return primitives.void;
                }
                throw new Error(`Unknown primitive ${type.primitive}`);
            }
            case 'pointer': return llvm.PointerType.get(convertType(type.pointer), 0);
        }
        throw new Error(`Unknown type ${type.type}`);
    }

    return {
        ...primitives,
        convertType,
        dereference: (type: Type) => {
            if(type.type !== 'pointer') throw new Error(`Cannot dereference non-pointer type ${type.type}`);
            return convertType(type.pointer);
        }
    };
}

export type Values = {
    int: (value: number) => llvm.Value;
    float: (value: number) => llvm.Value;
    string: (value: string) => llvm.Value;
    bool: (value: boolean) => llvm.Value;
    void: () => llvm.Value;
}

export function getValues(builder: llvm.IRBuilder, context: llvm.LLVMContext): Values {
    return {
        int: (value: number) => builder.getInt64(value),
        float: (value: number) => {
            // use ConstantFP
            const constantFP = llvm.ConstantFP.get(builder.getDoubleTy(), value);
            return builder.CreateFPCast(constantFP, builder.getDoubleTy()); 
        },
        string: (value: string) => builder.CreateGlobalStringPtr(value),
        bool: (value: boolean) => builder.getInt1(value),
        void: () => llvm.UndefValue.get(builder.getVoidTy()),
    };
}