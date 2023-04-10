import llvm from 'llvm-bindings';
import { Types, Values, getTypes, getValues } from './llvm-types';

import * as fs from 'fs';
import { StdioOptions, spawn } from 'child_process'

const promisedSpawn = (command: string, args: string[], options: { stdio?: StdioOptions } = {}) => new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('exit', (code) => {
        if(code === 0) resolve();
        else reject();
    });
});

export default class LLVMModule {

    private readonly _name: string;

    public readonly _context: llvm.LLVMContext;
    public readonly _module: llvm.Module;
    private readonly _builder: llvm.IRBuilder;

    public readonly Types: Types
    public readonly Values: Values

    constructor(name: string) {
        this._name = name;

        this._context = new llvm.LLVMContext();
        this._module = new llvm.Module(name, this._context);
        this._builder = new llvm.IRBuilder(this._context);

        this.Types = getTypes(this._builder);
        this.Values = getValues(this._builder, this._context);
    }

    public get builder(): llvm.IRBuilder {
        return this._builder;
    }

    public createMain() {
        const functionType = llvm.FunctionType.get(this.Types.int, [], false);
        return llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'main', this._module);
    }

    public exitMain() {
        this._builder.CreateRet(this.Values.int(0));
        this._builder.ClearInsertionPoint();
    }

    public verify(silent: boolean = false){
        if(llvm.verifyModule(this._module)) {
            if(!silent) console.error('Verifying module failed');
            return false;
        }
        return true;
    }

    public print() {
        return this._module.print();
    }

    public async executeJIT(output: string = this._name, stdio?: StdioOptions) {
        if(!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
        fs.writeFileSync(`./tmp/${output}.ll`, this.print());
        await promisedSpawn('lli', [`./tmp/${output}.ll`], { stdio })
    }

    public async generateExecutable(output: string = this._name, linkedObjFiles: string[], stdio?: StdioOptions) {
        await this.generateObject(output, stdio);
        await promisedSpawn('gcc', [...linkedObjFiles, `./tmp/${output}.o`, '-o', `./${output}`], { stdio });
    }

    public async generateObject(output: string = this._name, stdio?: StdioOptions) {
        if(!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
        llvm.WriteBitcodeToFile(this._module, `./tmp/${output}.bc`);
        await promisedSpawn('llc', ['-filetype=obj', `./tmp/${output}.bc`, '-o', `./tmp/${output}.o`], { stdio });
    }
}