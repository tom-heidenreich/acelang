import llvm from 'llvm-bindings';

import { Int32Type } from './types';
import { Int32Value } from './values';

export default class LLVMModule {

    public readonly context: llvm.LLVMContext;
    public readonly _module: llvm.Module;
    public readonly builder: llvm.IRBuilder;

    constructor(name: string) {
        this.context = new llvm.LLVMContext();
        this._module = new llvm.Module(name, this.context);
        this.builder = new llvm.IRBuilder(this.context);
    }

    public createMain() {
        const functionType = llvm.FunctionType.get(new Int32Type().toLLVM(this), [], false);
        return llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'main', this._module);
    }

    public exitMain() {
        this.builder.CreateRet(new Int32Value(0).toLLVM(this));
        this.builder.ClearInsertionPoint();
    }

    public verify(silent: boolean = false){
        if(llvm.verifyModule(this._module)) {
            if(!silent) console.error('Verifying module failed');
            return false;
        }
        return true;
    }

    public toString() {
        return this._module.print();
    }
}