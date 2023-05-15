import llvm from "llvm-bindings";
import { ArrayValue, Callable, FunctionBinding, IfStatement, Statement, StructValue, Value, VariableDeclaration, WhileStatement, Global, ArrayType, StructType, CallableType, VoidType, PointerType, BooleanType } from "../types";
import LLVMModule from "./llvm-module";

export function parseStatements(module: LLVMModule, scope: Scope, statements: Statement[]): void {
    if(statements.length === 1) {
        if(scope.hasExited()) throw new Error('Unreachable code')
        const statement = statements[0];
        if(statement.type === 'multiStatement') return parseStatements(module, scope, statement.statements);
        switch(statement.type) {
            case 'importStatement': return;
            case 'exportStatement': return;
            case 'expressionStatement': {
                statement.expression.compile(module, scope);
                return;
            }
            case 'variableDeclaration': return parseVariableDeclaration(statement, module, scope);
            case 'functionDeclaration': {
                const { outsideOfScopeAccesses } = statement;
                for(const { name, globalRef } of outsideOfScopeAccesses) {

                    const ref = scope.get(name);
                    if(!ref) throw new Error(`Unexpected error. Reference ${name} not found`);
        
                    const globalRefValue = scope.get(globalRef);
                    if(!globalRefValue) throw new Error(`Unexpected error. Global reference ${globalRef} not found`);
        
                    module.builder.CreateStore(ref, globalRefValue);
                }
                return
            }
            case 'returnStatement': {
                if(!statement.value) module.builder.CreateRetVoid();
                else {
                    const value = statement.value.compile(module, scope);
                    if(value.getType().isVoidTy()) module.builder.CreateRetVoid();
                    else module.builder.CreateRet(value);
                }
                scope.exit();
                return;
            }
            case 'throwStatement': {
                if(!statement.value) throw new Error('Illegal throw statement');
                // const value = statement.value.compile(module, scope);

                // get exception flag
                const exceptionFlag = scope.get('%exception');
                if(!exceptionFlag) throw new Error('Illegal throw statement');

                // set exception flag
                module.builder.CreateStore(module.Values.bool(true), exceptionFlag);

                // exit function
                const returnType = scope.parentFunc.getReturnType();
                if(returnType.isVoidTy()) module.builder.CreateRetVoid();
                else module.builder.CreateRet(module.Values.null(scope.parentFunc.getReturnType()))

                scope.exit();
                return
            }
            case 'whileStatement': return parseWhileStatement(statement, module, scope);
            case 'ifStatement': return parseIfStatement(statement, module, scope);
            case 'breakStatement': {
                if(!scope.exitBlock) throw new Error('Illegal break statement');
                module.builder.CreateBr(scope.exitBlock);
                scope.exit();
                return;
            }
            case 'continueStatement': {
                if(!scope.loopBlock) throw new Error('Illegal continue statement');
                module.builder.CreateBr(scope.loopBlock);
                scope.exit();
                return;
            }
        }
        throw new Error(`Unknown statement type ${statement.type}`);
    }
    for(const statement of statements) {
        parseStatements(module, scope, [statement]);
    }
}

export class Scope {

    public readonly parentFunc: llvm.Function

    private values: Map<string, llvm.Value>;
    private parent?: Scope

    private blockCounts: Map<string, number> = new Map();

    private readonly exitBB: llvm.BasicBlock | undefined
    private readonly loopBB: llvm.BasicBlock | undefined

    private exited: boolean = false;

    constructor(func: llvm.Function, parent?: Scope, blocks?: { exit?: llvm.BasicBlock, loop?: llvm.BasicBlock }) {
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

// function compileValue(module: LLVMModule, scope: Scope, value: Value): llvm.Value {
//     switch(value.type) {
//         case 'undefined': return module.Values.undefined();
//     }
//     throw new Error(`Unknown value type ${value.type}`);
// }

function parseVariableDeclaration(statement: VariableDeclaration, module: LLVMModule, scope: Scope): void {
    const { name, value, valueType } = statement;

    // special cases
    if(valueType instanceof ArrayType) {
        const _var = module.builder.CreateAlloca(valueType.toLLVM(module));
        scope.set(name, _var);
        // initialize array
        if(value) {
            if(!(value instanceof ArrayValue)) throw new Error(`Expected array value for array variable ${name}`);
            value.compile(module, scope, _var);
        }
        return;
    }
    else if(valueType instanceof StructType) {
        const _var = module.builder.CreateAlloca(valueType.toLLVM(module));
        scope.set(name, _var);
        // initialize struct
        if(value) {
            if(!(value instanceof StructValue)) throw new Error(`Expected struct value for struct variable ${name}`);
            value.compile(module, scope, _var, valueType);
        }
        return;
    }
    else if(valueType instanceof CallableType) throw new Error(`Cannot store callable in variable ${name}`);

    let compiledValue: llvm.Value | undefined;
    if(value) compiledValue = value.compile(module, scope);

    const _var = module.builder.CreateAlloca(valueType.toLLVM(module));
    scope.set(name, _var);

    if(compiledValue) {
        module.builder.CreateStore(compiledValue, _var);
    }
}

function parseWhileStatement(statement: WhileStatement, module: LLVMModule, scope: Scope): void {

    const loopBodyBB = llvm.BasicBlock.Create(module._context, scope.blockId('loopBody'), scope.parentFunc);
    const loopExitBB = llvm.BasicBlock.Create(module._context, scope.blockId('loopExit'), scope.parentFunc);

    const condition = () => {
        const conditionValue = statement.condition.compile(module, scope);
        return module.builder.CreateCondBr(conditionValue, loopBodyBB, loopExitBB);
    }

    const whileScope = new Scope(scope.parentFunc, scope, {
        exit: loopExitBB,
        loop: loopBodyBB,
    });

    condition()
    module.builder.SetInsertPoint(loopBodyBB);

    parseStatements(module, whileScope, statement.body);

    condition();
    module.builder.SetInsertPoint(loopExitBB);

}

function parseIfStatement(statement: IfStatement, module: LLVMModule, scope: Scope) {

    const thenBodyBB = llvm.BasicBlock.Create(module._context, scope.blockId('thenBody'), scope.parentFunc);
    const elseBodyBB = llvm.BasicBlock.Create(module._context, scope.blockId('elseBody'), scope.parentFunc);
    const exitBB = llvm.BasicBlock.Create(module._context, scope.blockId('ifExit'), scope.parentFunc);

    const condition = statement.condition.compile(module, scope);
    module.builder.CreateCondBr(condition, thenBodyBB, elseBodyBB);

    module.builder.SetInsertPoint(thenBodyBB);
    const thenScope = new Scope(scope.parentFunc, scope, {
        exit: exitBB,
    });
    parseStatements(module, thenScope, statement.body);
    if(!thenScope.hasExited()) module.builder.CreateBr(exitBB);

    module.builder.SetInsertPoint(elseBodyBB);

    // add else if statements
    if(statement.elseIf) {
        for(const elseIf of statement.elseIf) parseIfStatement(elseIf, module, scope);
    }

    // add else statement
    let elseExited = false;
    if(statement.else) {
        const elseScope = new Scope(scope.parentFunc, scope, {
            exit: exitBB,
        });
        parseStatements(module, elseScope, statement.else);
        elseExited = elseScope.hasExited()
    }
    
    if(!elseExited) module.builder.CreateBr(exitBB);
    module.builder.SetInsertPoint(exitBB);
}

export function defineGlobal(module: LLVMModule, scope: Scope, global: Global, globalName: string) {
    const type = global.type.toLLVM(module);
    var _global: llvm.GlobalVariable;
    if(global.isConst) {
        if(!global.value) throw new Error(`Global ${globalName} is const but has no value`);
        const _value = global.value.compile(module, scope);
        if(!(_value instanceof llvm.Constant)) throw new Error(`Global ${globalName} is const but has non-constant value`);
        _global = new llvm.GlobalVariable(module._module, type, true, llvm.GlobalValue.LinkageTypes.InternalLinkage, _value, globalName);
    }
    else {
        _global = new llvm.GlobalVariable(module._module, type, false, llvm.GlobalValue.LinkageTypes.InternalLinkage, module.Values.null(type), globalName);
        if(global.value) {
            const _value = global.value.compile(module, scope);
            module.builder.CreateStore(_value, _global);
        }
    }
    scope.set(globalName, _global);
}

export function defineFunction(module: LLVMModule, scope: Scope, callable: Callable, callableName: string) {
    if(callable.isBuiltIn) return;

    const returnType = callable.returnType.toLLVM(module);
    const paramTypes = callable.params.map(param => param.type.toLLVM(module));

    if(callable.canThrowException) paramTypes.unshift(new PointerType(new BooleanType()).toLLVM(module));

    const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
    const _function = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, callableName, module._module);

    const entryBlock = llvm.BasicBlock.Create(module._context, 'entry', _function);
    module.builder.SetInsertPoint(entryBlock);

    // create new scope
    const newScope = new Scope(_function, scope);

    // add self to scope
    newScope.set(callableName, _function);

    let argOffset = 0;
    if(callable.canThrowException) {
        argOffset = 1;
        const flag = _function.getArg(0);
        newScope.set('%exception', flag);
    }

    for(let i = argOffset; i < _function.arg_size(); i++) {
        const arg = _function.getArg(i);
        const param = callable.params[i - argOffset];
        newScope.set(param.name, arg);
    }

    // parse statements
    parseStatements(module, newScope, callable.body);

    // return if no return statement
    if(!newScope.hasExited()) {
        if(!(callable.returnType instanceof VoidType)) {
            throw new Error(`Function ${callableName} must return a value`);
        }
        module.builder.CreateRetVoid();
    }

    module.builder.ClearInsertionPoint();

    scope.set(callableName, _function);
}

export function declareFunction(module: LLVMModule, scope: Scope, binding: FunctionBinding) {
    const returnType = binding.returnType.toLLVM(module);
    const paramTypes = binding.params.map(param => param.toLLVM(module));

    const _funcType = llvm.FunctionType.get(returnType, paramTypes, false);
    const _func = llvm.Function.Create(_funcType, llvm.Function.LinkageTypes.ExternalLinkage, binding.name, module._module);

    scope.set(binding.name, _func);
}