import llvm from 'llvm-bindings';

export type Types = {
    int: llvm.Type;
    float: llvm.Type;
    string: llvm.Type;
    bool: llvm.Type;
    void: llvm.Type;
}

export function getTypes(builder: llvm.IRBuilder): Types {
    return {
        int: builder.getInt64Ty(),
        float: builder.getDoubleTy(),
        string: builder.getInt8PtrTy(),
        bool: builder.getInt1Ty(),
        void: builder.getVoidTy(),
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