import llvm, { IRBuilder } from 'llvm-bindings';
import * as fs from 'fs';
import { spawn } from 'child_process';

// types
const TYPES = {
    INT: (builder: IRBuilder) => builder.getInt32Ty(),
    FLOAT: (builder: IRBuilder) => builder.getFloatTy(),
    BOOL: (builder: IRBuilder) => builder.getInt1Ty(),
    STRING: (builder: IRBuilder) => builder.getInt8PtrTy(),
    VOID: (builder: IRBuilder) => builder.getVoidTy(),
}

enum Linkage {
    ExternalLinkage,
    AvailableExternallyLinkage,
    LinkOnceAnyLinkage,
    LinkOnceODRLinkage,
    WeakAnyLinkage,
    WeakODRLinkage,
    AppendingLinkage,
    InternalLinkage,
    PrivateLinkage,
    ExternalWeakLinkage,
    CommonLinkage,
    LinkerPrivateLinkage,
    LinkerPrivateWeakLinkage,
    GhostLinkage,
    NumberOfLinkageTypes,
  }

export async function compile() {

    const context = new llvm.LLVMContext();
    const _module = new llvm.Module('main', context);

    // Create a function with return type int and no arguments
    const funcType = llvm.FunctionType.get(llvm.Type.getInt32Ty(context), [], false);
    const func = llvm.Function.Create(funcType, Linkage.ExternalLinkage, 'main', _module);

    // Create a basic block for the function
    const entryBlock = llvm.BasicBlock.Create(context, 'entry', func);
    const builder = new llvm.IRBuilder(entryBlock);

    // create an LLVM integer type
    const intType = llvm.Type.getInt32Ty(context);

    // declare variable a with int value 2
    const a = builder.CreateAlloca(intType, null, 'a');
    builder.CreateStore(builder.getInt32(2), a);

    // return value 0
    builder.CreateRet(builder.getInt32(0));

    if(llvm.verifyModule(_module)) {
        console.error('Verifying module failed');
        return;
    }

    // write IR to file
    const irString = _module.print();
    fs.writeFileSync('main.ll', irString);

    // compile IR to object file
    const llcArgs = ['-filetype=obj', '-o', 'main.o', 'main.ll'];
    const llcProcess = spawn('llc', llcArgs);
    await new Promise((resolve) => {
        llcProcess.on('exit', resolve);
    });

    console.log('Generated object file: main.o');
}

compile();