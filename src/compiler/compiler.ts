import llvm from "llvm-bindings";
import { Callable, FunctionBinding, IfStatement, Statement, Value, VariableDeclaration, WhileStatement } from "../types";
import LLVMModule from "./llvm-module";

export function parseStatements(module: LLVMModule, context: Context, statements: Statement[]): void {
    if(statements.length === 1) {
        const statement = statements[0];
        if(statement.type === 'multiStatement') return parseStatements(module, context, statement.statements);
        switch(statement.type) {
            case 'importStatement': return;
            case 'exportStatement': return;
            case 'expressionStatement': {
                compileValue(module, context, statement.expression);
                return;
            }
            case 'variableDeclaration': return parseVariableDeclaration(statement, module, context);
            case 'functionDeclaration': return
            case 'returnStatement': {
                const value = compileValue(module, context, statement.value);
                module.builder.CreateRet(value);
                return;
            }
            case 'whileStatement': return parseWhileStatement(statement, module, context);
        }
        throw new Error(`Unknown statement type ${statement.type}`);
    }
    for(const statement of statements) {
        parseStatements(module, context, [statement]);
    }
}

export class Context {

    public readonly parentFunc: llvm.Function

    private values: Map<string, llvm.Value>;
    private parent?: Context

    private blockCounts: Map<string, number> = new Map();

    constructor(func: llvm.Function, parent?: Context) {
        this.parentFunc = func;
        this.values = new Map();
        this.parent = parent;
    }

    public set(name: string, value: llvm.Value) {
        this.values.set(name, value);
    }

    public get(name: string): llvm.Value | undefined {
        if(this.values.has(name)) return this.values.get(name);
        if(this.parent) return this.parent.get(name);
        return undefined;
    }

    public blockId(name: string): string {
        const count = this.blockCounts.get(name) ?? 0;
        this.blockCounts.set(name, count + 1);
        return `${name}.${count}`;
    }
}

function compileValue(module: LLVMModule, context: Context, value: Value): llvm.Value {
    switch(value.type) {
        case 'literal': {
            switch(value.literalType) {
                case 'int': return module.Values.int(value.literal as number);
                case 'float': return module.Values.float(value.literal as number);
                case 'string': return module.Values.string(value.literal as string);
                case 'boolean': return module.Values.bool(value.literal as boolean);
            }
        }
        case 'undefined': return module.Values.undefined();
        case 'array': {
            const arrayType = module.Types.array(module.Types.convertType(value.itemType), value.items.length);
            const constants: llvm.Constant[] = value.items.map((item, index) => {
                const value = compileValue(module, context, item)
                if(value instanceof llvm.Constant) return value;
                throw new Error(`Array item ${index} is not a constant`)
            });
            return llvm.ConstantArray.get(arrayType, constants)
        }
        case 'member': {
            const target = compileValue(module, context, value.target);
            const property = compileValue(module, context, value.property);

            if(!property.getType().isIntegerTy(32)) throw new Error(`Unknown property type, expected int`);
            return module.builder.CreateGEP(module.Types.convertType(value.targetType), target, [module.Values.int(0), property]);
        }
        case 'reference': {
            const ref = context.get(value.reference);
            if(!ref) throw new Error(`Unknown reference ${value.reference}`);
            return ref;
        }
        case 'dereference': {
            const target = compileValue(module, context, value.target);
            if(!(target.getType() instanceof llvm.PointerType)) return target;
            return module.builder.CreateLoad(target.getType().getPointerElementType(), target)
        }
        case 'call': {
            const argValues = value.args.map(arg => compileValue(module, context, arg));
            const callable = compileValue(module, context, value.callable);
            if(callable instanceof llvm.Function) return module.builder.CreateCall(callable, argValues);
            throw new Error(`Unknown callable type ${value.callable.type}`);
        }
        case 'assign': {
            const target = compileValue(module, context, value.target);
            const assignValue = compileValue(module, context, value.value);
            return module.builder.CreateStore(assignValue, target);
        }
        case 'add': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateAdd(left, right);
        }
        case 'subtract': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateSub(left, right);
        }
        case 'multiply': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateMul(left, right);
        }
        case 'divide': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            return module.builder.CreateSDiv(left, right);
        }
        case 'lessThan': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            let result
            if(value.numberType === 'float') result = module.builder.CreateFCmpULT(left, right);
            else result = module.builder.CreateICmpSLT(left, right);
            return module.builder.CreateZExt(result, module.Types.bool);
        }
        case 'greaterThan': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            let result
            if(value.numberType === 'float') result = module.builder.CreateFCmpUGT(left, right);
            else result = module.builder.CreateICmpSGT(left, right);
            return module.builder.CreateZExt(result, module.Types.bool);
        }
        case 'lessThanEquals': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            let result
            if(value.numberType === 'float') result = module.builder.CreateFCmpULE(left, right);
            else result = module.builder.CreateICmpSLE(left, right);
            return module.builder.CreateZExt(result, module.Types.bool);
        }
        case 'greaterThanEquals': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            let result
            if(value.numberType === 'float') result = module.builder.CreateFCmpUGE(left, right);
            else result = module.builder.CreateICmpSGE(left, right);
            return module.builder.CreateZExt(result, module.Types.bool);
        }
        case 'cast': {
            const target = compileValue(module, context, value.value);
            switch(value.currentType) {
                case 'int': {
                    switch(value.targetType) {
                        case 'float': return module.builder.CreateSIToFP(target, module.Types.float);
                        case 'boolean': return module.builder.CreateICmpNE(target, module.Values.int(0));
                    }
                }
                case 'float': {
                    switch(value.targetType) {
                        case 'int': return module.builder.CreateFPToSI(target, module.Types.int);
                        case 'boolean': return module.builder.CreateFCmpONE(target, module.Values.float(0));
                    }
                }
                case 'boolean': {
                    switch(value.targetType) {
                        case 'int': return module.builder.CreateZExt(target, module.Types.int);
                        case 'float': return module.builder.CreateUIToFP(target, module.Types.float);
                    }
                }
            }
            throw new Error(`Unknown cast ${value.currentType} -> ${value.targetType}`);
        }
    }
    throw new Error(`Unknown value type ${value.type}`);
}

function parseVariableDeclaration(statement: VariableDeclaration, module: LLVMModule, context: Context): void {
    const { name, value, valueType } = statement;

    // special case for arrays
    if(valueType.type === 'array') {
        const arrayType = module.Types.convertType(valueType);
        const _var = module.builder.CreateAlloca(arrayType);
        context.set(name, _var);
        // initialize array
        if(value) {
            if(value.type !== 'array') throw new Error(`Expected array value for array variable ${name}`);
            for(let i = 0; i<value.items.length; i++) {
                const item = value.items[i];
                const compiledItem = compileValue(module, context, item);
                const itemPtr = module.builder.CreateGEP(arrayType, _var, [module.Values.int(0), module.Values.int(i)]);
                module.builder.CreateStore(compiledItem, itemPtr);
            }
        }
        return;
    }
    else if(valueType.type === 'struct') {
        const structType = module.Types.convertType(valueType);
        const _var = module.builder.CreateAlloca(structType);
        context.set(name, _var);
        // initialize struct
        if(value) {
            if(value.type !== 'struct') throw new Error(`Expected struct value for struct variable ${name}`);
            const entries = Object.entries(value.properties);
            for(let i = 0; i<entries.length; i++) {
                const [_, item] = entries[i];
                const compiledItem = compileValue(module, context, item);
                const itemPtr = module.builder.CreateGEP(structType, _var, [module.Values.int(0), module.Values.int(i)]);
                module.builder.CreateStore(compiledItem, itemPtr);
            }
        }
        return;
    }

    let compiledValue: llvm.Value | undefined;
    if(value) compiledValue = compileValue(module, context, value);

    const type = module.Types.convertType(valueType)
    const _var = module.builder.CreateAlloca(type);
    context.set(name, _var);

    if(compiledValue) {
        module.builder.CreateStore(compiledValue, _var);
    }
}

function parseWhileStatement(statement: WhileStatement, module: LLVMModule, context: Context): void {

    const loopBodyBB = llvm.BasicBlock.Create(module._context, context.blockId('loopBody'), context.parentFunc);
    const loopExitBB = llvm.BasicBlock.Create(module._context, context.blockId('loopExit'), context.parentFunc);

    const condition = () => {
        const conditionValue = compileValue(module, context, statement.condition);
        return module.builder.CreateCondBr(conditionValue, loopBodyBB, loopExitBB);
    }

    const whileContext = new Context(context.parentFunc, context);

    module.builder.CreateBr(loopBodyBB);
    module.builder.SetInsertPoint(loopBodyBB);

    parseStatements(module, whileContext, statement.body);

    condition();
    module.builder.SetInsertPoint(loopExitBB);

}

export function defineFunction(module: LLVMModule, context: Context, callable: Callable, callableName: string) {
    if(callable.isBuiltIn) return;

    const returnType = module.Types.convertType(callable.returnType)
    const paramTypes = callable.params.map(param => module.Types.convertType(param.type));

    const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
    const _function = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, callableName, module._module);

    const entryBlock = llvm.BasicBlock.Create(module._context, 'entry', _function);
    module.builder.SetInsertPoint(entryBlock);

    // create new context
    const newContext = new Context(_function, context);

    for(let i = 0; i < _function.arg_size(); i++) {
        const arg = _function.getArg(i);
        const param = callable.params[i];
        newContext.set(param.name, arg);
    }

    // parse statements
    parseStatements(module, newContext, callable.body);

    // return void if no return type
    if(callable.returnType.type === 'primitive' && callable.returnType.primitive === 'void') {
        module.builder.CreateRetVoid();
    }

    module.builder.ClearInsertionPoint();

    context.set(callableName, _function);
}

export function declareFunction(module: LLVMModule, context: Context, binding: FunctionBinding) {
    const returnType = module.Types.convertType(binding.returnType)
    const paramTypes = binding.params.map(param => module.Types.convertType(param));

    const _funcType = llvm.FunctionType.get(returnType, paramTypes, false);
    const _func = llvm.Function.Create(_funcType, llvm.Function.LinkageTypes.ExternalLinkage, binding.name, module._module);

    context.set(binding.name, _func);
}