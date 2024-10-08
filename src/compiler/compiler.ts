import llvm from "llvm-bindings";
import { Callable, FunctionBinding, IfStatement, Statement, Value, VariableDeclaration, WhileStatement } from "../types";
import LLVMModule from "./llvm-module";

export function parseStatements(module: LLVMModule, context: Context, statements: Statement[]): void {
    if(statements.length === 1) {
        if(context.hasExited()) throw new Error('Unreachable code')
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
                if(value.getType().isVoidTy()) module.builder.CreateRetVoid();
                else module.builder.CreateRet(value);
                context.exit();
                return;
            }
            case 'whileStatement': return parseWhileStatement(statement, module, context);
            case 'ifStatement': return parseIfStatement(statement, module, context);
            case 'breakStatement': {
                if(!context.exitBlock) throw new Error('Illegal break statement');
                module.builder.CreateBr(context.exitBlock);
                context.exit();
                return;
            }
            case 'continueStatement': {
                if(!context.loopBlock) throw new Error('Illegal continue statement');
                module.builder.CreateBr(context.loopBlock);
                context.exit();
                return;
            }
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

    private readonly exitBB: llvm.BasicBlock | undefined
    private readonly loopBB: llvm.BasicBlock | undefined

    private exited: boolean = false;

    constructor(func: llvm.Function, parent?: Context, blocks?: { exit?: llvm.BasicBlock, loop?: llvm.BasicBlock }) {
        this.parentFunc = func;
        this.values = new Map();
        this.parent = parent;

        this.exitBB = blocks?.exit;
        this.loopBB = blocks?.loop;
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

    public get exitBlock(): llvm.BasicBlock | undefined {
        if(this.exitBB) return this.exitBB;
        if(this.parent) return this.parent.exitBlock;
        return undefined;
    }

    public get loopBlock(): llvm.BasicBlock | undefined {
        if(this.loopBB) return this.loopBB;
        if(this.parent) return this.parent.loopBlock;
        return undefined;
    }

    public exit() {
        this.exited = true;
    }

    public hasExited() {
        return this.exited;
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
        case 'arrowFunction': {
            const ref = context.get(value.name);
            if(!ref) throw new Error(`Unexpected error. Callable ${value.name} not found`);
            return ref;
        }
        case 'dereference': {
            const target = compileValue(module, context, value.target);
            if(!(target.getType() instanceof llvm.PointerType)) return target;
            return module.builder.CreateLoad(target.getType().getPointerElementType(), target)
        }
        case 'pointerCast': {
            const target = compileValue(module, context, value.target);
            return module.builder.CreatePointerCast(target, llvm.PointerType.get(module.Types.convertType(value.targetType), 0));
        }
        case 'call': {
            const argValues = value.args.map(arg => compileValue(module, context, arg));
            const callable = compileValue(module, context, value.callable);
            if(callable instanceof llvm.Function) return module.builder.CreateCall(callable, argValues);
            if(callable.getType() instanceof llvm.PointerType) {
                const elementType = callable.getType().getPointerElementType()
                if(elementType instanceof llvm.FunctionType) {
                    return module.builder.CreateCall(elementType, callable, argValues);
                }
                throw new Error(`Cannot call pointer type. ${callable.getType().isPointerTy() ? 'Did you forget to dereference?' : ''}`);
            }
            if(!(callable.getType() instanceof llvm.FunctionType)) {
                throw new Error(`Cannot call non-function type.`);
            }
            return module.builder.CreateCall(callable.getType(), callable, argValues);
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
        case 'equals': {
            const left = compileValue(module, context, value.left);
            const right = compileValue(module, context, value.right);
            let result = module.builder.CreateICmpEQ(left, right);
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

    // special cases
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
    else if(valueType.type === 'callable') throw new Error(`Cannot store callable in variable ${name}`);

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

    const whileContext = new Context(context.parentFunc, context, {
        exit: loopExitBB,
        loop: loopBodyBB,
    });

    condition()
    module.builder.SetInsertPoint(loopBodyBB);

    parseStatements(module, whileContext, statement.body);

    condition();
    module.builder.SetInsertPoint(loopExitBB);

}

function parseIfStatement(statement: IfStatement, module: LLVMModule, context: Context) {

    const thenBodyBB = llvm.BasicBlock.Create(module._context, context.blockId('thenBody'), context.parentFunc);
    const elseBodyBB = llvm.BasicBlock.Create(module._context, context.blockId('elseBody'), context.parentFunc);
    const exitBB = llvm.BasicBlock.Create(module._context, context.blockId('ifExit'), context.parentFunc);

    const condition = compileValue(module, context, statement.condition);
    module.builder.CreateCondBr(condition, thenBodyBB, elseBodyBB);

    module.builder.SetInsertPoint(thenBodyBB);
    const thenContext = new Context(context.parentFunc, context, {
        exit: exitBB,
    });
    parseStatements(module, thenContext, statement.body);
    if(!thenContext.hasExited()) module.builder.CreateBr(exitBB);

    module.builder.SetInsertPoint(elseBodyBB);

    // add else if statements
    if(statement.elseIf) {
        for(const elseIf of statement.elseIf) parseIfStatement(elseIf, module, context);
    }

    // add else statement
    let elseExited = false;
    if(statement.else) {
        const elseContext = new Context(context.parentFunc, context, {
            exit: exitBB,
        });
        parseStatements(module, elseContext, statement.else);
        elseExited = elseContext.hasExited()
    }
    
    if(!elseExited) module.builder.CreateBr(exitBB);
    module.builder.SetInsertPoint(exitBB);
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

    // add self to context
    newContext.set(callableName, _function);

    for(let i = 0; i < _function.arg_size(); i++) {
        const arg = _function.getArg(i);
        const param = callable.params[i];
        newContext.set(param.name, arg);
    }

    // parse statements
    parseStatements(module, newContext, callable.body);

    // return if no return statement
    if(!newContext.hasExited()) {
        if(callable.returnType.type !== 'primitive' || callable.returnType.primitive !== 'void') {
            throw new Error(`Function ${callableName} must return a value`);
        }
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