import llvm from "llvm-bindings";
import { Scope } from "./compiler/compiler";
import LLVMModule from "./compiler/llvm-module";
import { Controller } from "./lexer";
import { ModuleManager } from "./modules";
import Values from "./values";

export type TokenType = 'datatype' | 'identifier' | 'symbol' | 'operator' | 'keyword' | 'modifier' | 'block'

export type TokenLine = {
    line: number;
    char: number;
    endLine: number;
    endChar: number;
    file: string
}

export type Token = {
    value: string;
    type: string;
    specificType?: string;
    block?: Token[][];
    lineInfo: TokenLine;
}

export type SimpleToken = {
    value: string;
    type: string;
    specificType?: string;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'boolean', 'void', 'any', 'undefined']
export const KEYWORDS: Keyword[] = [
    'debug',
    'const',
    'var',
    'func',
    'sync',
    'return',
    'type',
    'if',
    'else',
    'while',
    'break',
    'continue',
    'for',
    'of',
    'class',
    'constructor',
    'new',
    'export',
    'as',
    'import',
    'from',
    'extends',
    'as',
    'declare'
]
export const MODIFIERS: Modifier[] = ['public', 'private', 'static', 'abstract']
export const OPERATORS: Operator[] = [
    '=',
    '+=',
    '-=',
    '*=',
    '/=',
    '+',
    '-',
    '*',
    '/',
    '>',
    '<',
    '^',
    '%',
    '==',
    '!=',
    '>=',
    '<=',
    '&&',
    '||',
    '!',
    '=>',
    '$'
]
export const SYMBOLS: Symbol[] = [':', ',', '.', '|', '?']

export type LiteralDataType = 'string' | 'int' | 'float' | 'boolean'
export type DataType = LiteralDataType | 'void' | 'unknown' | 'callable' | 'object' | 'any' | 'undefined';
export type Keyword = (
    'debug' |
    'const' |
    'var' |
    'func' |
    'sync' |
    'return' |
    'type' |
    'if' |
    'else' |
    'while' |
    'break' |
    'continue' |
    'for' |
    'of' |
    'class' |
    'constructor' |
    'new' |
    'export' |
    'as' |
    'import' |
    'from' |
    'extends' |
    'as' |
    'declare'
)
export type Modifier = 'public' | 'private' | 'static' | 'abstract';
export type Symbol =  Operator | ':' | ',' | '.' | '|' | '?'
export type Operator = (
    '=' |
    '+=' |
    '-=' |
    '*=' |
    '/=' |
    '+' |
    '-' |
    '*' |
    '/' |
    '>' |
    '<' |
    '^' |
    '%' |
    '==' |
    '!=' |
    '>=' |
    '<=' |
    '&&' |
    '||' |
    '!' |
    '=>' |
    '$'
);

export type Identifier = string;
export type Literal = string | number | boolean;
export type Key = string | number;
export type Modifiers = {
    access?: 'public' | 'private',
    isStatic?: boolean,
    isAbstract?: boolean,
    isFinal?: boolean,
}

// fields
export type Field = {
    type: Type,
}

export type Fields = {
    [name: string]: Field
}

export type FieldEnv = {
    parent?: FieldEnv,
    local: Fields,
}

// functions
export type Param = {
    name: string,
    type: Type,
}

export type Callable = {
    body: Statement[],
    params: Param[],
    returnType: Type,
    isSync: boolean,
    // TODO: rename this. imports uses this too
    isBuiltIn?: boolean,
}

// types

export type LiteralType = {
    type: 'literal',
    literal: Literal
}

export type UnionType = {
    type: 'union',
    oneOf: Type[]
}

export type StructType = {
    type: 'struct',
    properties: Types
}

// TODO: check if this should be named map
export type ObjectType = {
    type: 'object',
    values: Type
}

export type ArrayType = {
    type: 'array',
    items: Type,
    size: number,
}

export type CallableType = {
    type: 'callable',
    params: Type[],
    returnType: Type,
}

export type ClassType = {
    type: 'class',
    params: Type[],
    statics: Types,
    publicType: StructType,
    privateType: StructType,
}

export type PrimitiveType = {
    type: 'primitive',
    primitive: DataType
}

export type PointerType = {
    type: 'pointer',
    pointer: Type
}

export type Type = PrimitiveType | UnionType | StructType | ArrayType | ObjectType | LiteralType | CallableType | ClassType | PointerType

export type Types = {
    [name: string]: Type,
}

// values
export abstract class Value {
    public abstract compile(module: LLVMModule, scope: Scope): llvm.Value;
    public abstract toString(): string;
}

export class ReferenceValue extends Value {
    constructor(private name: string) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const ref = scope.get(this.name)
        if(!ref) throw new Error(`Reference ${this.name} not found`)
        return ref
    }
    public toString(): string {
        return this.name
    }
    public get reference(): string {
        return this.name
    }
}

// literals
export class IntValue extends Value {
    constructor(private value: number) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.int(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
}

export class FloatValue extends Value {
    constructor(private value: number) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.float(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
}

export class StringValue extends Value {
    constructor(private value: string) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.string(this.value)
    }
    public toString(): string {
        return this.value
    }
}

export class BooleanValue extends Value {
    constructor(private value: boolean) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.bool(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
}

// objects
export class StructValue extends Value {

    public constructor(public properties: {[name: string]: Value}) {
        super()
    }

    public compile(module: LLVMModule, scope: Scope, alloca?: llvm.AllocaInst, structType?: StructType): llvm.Value {

        if(!alloca) throw new Error("Constant structs are not supported yet");

        if(!structType) throw new Error("Struct type is required");
        const type = module.Types.convertType(structType);

        // initialize struct
        const entries = Object.entries(this.properties);
        for(let i = 0; i<entries.length; i++) {
            const [_, item] = entries[i];
            const compiledItem = item.compile(module, scope);
            const itemPtr = module.builder.CreateGEP(type, alloca, [module.Values.int(0), module.Values.int(i)]);
            module.builder.CreateStore(compiledItem, itemPtr);
        }

        return alloca;
    }

    public toString(): string {
        return `{${Object.entries(this.properties).map(([name, value]) => `${name}: ${value}`).join(', ')}}`
    }
}

export class ArrayValue extends Value {
    constructor(public items: Value[], private itemType: Type) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope, alloca?: llvm.AllocaInst): llvm.Value {
        const arrayType = module.Types.array(module.Types.convertType(this.itemType), this.items.length);

        if(!alloca) {
            const constants: llvm.Constant[] = this.items.map((item, index) => {
                const value = item.compile(module, scope);
                if(value instanceof llvm.Constant) return value;
                throw new Error(`Array item ${index} is not a constant`)
            });
            return llvm.ConstantArray.get(arrayType, constants)
        }

        // initialize array
        for(let i = 0; i<this.items.length; i++) {
            const item = this.items[i];
            const compiledItem = item.compile(module, scope);
            const itemPtr = module.builder.CreateGEP(arrayType, alloca, [module.Values.int(0), module.Values.int(i)]);
            module.builder.CreateStore(compiledItem, itemPtr);
        }

        return alloca;
    }
    public toString(): string {
        return `[${this.items.map(item => item.toString()).join(', ')}]`
    }
}

export class ArrowFunctionValue extends Value {
    constructor(private name: string) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const ref = scope.get(this.name);
        if(!ref) throw new Error(`Unexpected error. Callable ${this.name} not found`);
        return ref;
    }
    public toString(): string {
        throw new Error("Method not implemented.");
    }
}

// expression
export class CallExpression extends Value {
    constructor(private callable: Value, private args: Value[]) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const argValues = this.args.map(arg => arg.compile(module, scope));
        const callable = this.callable.compile(module, scope);
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
    public toString(): string {
        return `(${this.callable})(${this.args.map(arg => arg.toString()).join(', ')})`
    }
}

export class MemberExpression extends Value {
    constructor(private target: Value, private property: Value, private targetType: Type) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        const property = this.property.compile(module, scope);

        if(!property.getType().isIntegerTy(32)) throw new Error(`Unknown property type, expected int`);
        return module.builder.CreateGEP(module.Types.convertType(this.targetType), target, [module.Values.int(0), property]);
    }
    public toString(): string {
        return `${this.target}[${this.property}]`
    }
}

export abstract class ExpressionValue extends Value {
    constructor(protected left: Value, protected right: Value) {
        super()
    }
    protected abstract compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value;
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const left = this.left.compile(module, scope);
        const right = this.right.compile(module, scope);
        return this.compileExpression(module, scope, left, right);
    }
}

export class AssignExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateStore(right, left);
    }
    public toString(): string {
        return `${this.left} = ${this.right}`
    }
}

// plus Expressions
export class AddExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateAdd(left, right);
    }
    public toString(): string {
        return `(${this.left} + ${this.right})`
    }
}

export class ConcatStringExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        throw new Error(`Not implemented`)
    }
    public toString(): string {
        return `(${this.left} + ${this.right})`
    }
}

// minus Expressions
export class SubtractExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateSub(left, right);
    }
    public toString(): string {
        return `(${this.left} - ${this.right})`
    }
}

// multiplication Expressions
export class MultiplyExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateMul(left, right);
    }
    public toString(): string {
        return `(${this.left} * ${this.right})`
    }
}

// division Expressions
export class DivideExpression extends ExpressionValue {
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateSDiv(left, right);
    }
    public toString(): string {
        return `(${this.left} / ${this.right})`
    }
}

// comparison Expressions
export abstract class ComparisionExpression extends ExpressionValue {
    protected abstract comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value;
    protected compileExpression(module: LLVMModule, scope: Scope, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateZExt(this.comparision(module, left, right), module.Types.bool);
    }
}

export class EqualsExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateICmpEQ(left, right);
    }
    public toString(): string {
        return `(${this.left} == ${this.right})`
    }
}

export class IntLessThanExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateICmpSLT(left, right);
    }
    public toString(): string {
        return `(${this.left} < ${this.right})`
    }
}

export class IntLessThanEqualsExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateICmpSLE(left, right);
    }
    public toString(): string {
        return `(${this.left} <= ${this.right})`
    }
}

export class IntGreaterThanExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateICmpSGT(left, right);
    }
    public toString(): string {
        return `(${this.left} > ${this.right})`
    }
}

export class IntGreaterThanEqualsExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateICmpSGE(left, right);
    }
    public toString(): string {
        return `(${this.left} >= ${this.right})`
    }
}

export class FloatLessThanExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateFCmpOLT(left, right);
    }
    public toString(): string {
        return `(${this.left} < ${this.right})`
    }
}

export class FloatLessThanEqualsExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateFCmpOLE(left, right);
    }
    public toString(): string {
        return `(${this.left} <= ${this.right})`
    }
}

export class FloatGreaterThanExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateFCmpOGT(left, right);
    }
    public toString(): string {
        return `(${this.left} > ${this.right})`
    }
}

export class FloatGreaterThanEqualsExpression extends ComparisionExpression {
    protected comparision(module: LLVMModule, left: llvm.Value, right: llvm.Value): llvm.Value {
        return module.builder.CreateFCmpOGE(left, right);
    }
    public toString(): string {
        return `(${this.left} >= ${this.right})`
    }
}

// cast Expressions
export abstract class CastExpression extends Value {
    public constructor(protected target: Value) {
        super()
    }
}

export class IntToFloatCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateSIToFP(target, module.Types.float);
    }
    public toString(): string {
        return `(${this.target} as float)`
    }
}

export class IntToBooleanCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateICmpNE(target, llvm.ConstantInt.get(module.Types.int, 0));
    }
    public toString(): string {
        return `(${this.target} as boolean)`
    }
}

export class FloatToIntCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateFPToSI(target, module.Types.int);
    }
    public toString(): string {
        return `(${this.target} as int)`
    }
}

export class FloatToBooleanCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateFCmpONE(target, llvm.ConstantFP.get(module.Types.float, 0));
    }
    public toString(): string {
        return `(${this.target} as boolean)`
    }
}

export class BooleanToIntCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateZExt(target, module.Types.int);
    }
    public toString(): string {
        return `(${this.target} as int)`
    }
}

export class BooleanToFloatCast extends CastExpression {
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope);
        return module.builder.CreateUIToFP(target, module.Types.float)
    }
    public toString(): string {
        return `(${this.target} as float)`
    }
}

// pointers
export class DereferenceValue extends Value {
    public constructor(protected target: Value) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope)
        if(!(target.getType() instanceof llvm.PointerType)) throw new Error(`Cannot dereference non-pointer type ${target.getType()}`)
        return module.builder.CreateLoad(target.getType().getPointerElementType(), target)
    }
    public toString(): string {
        return `$${this.target}`
    }
}

export class PointerCastValue extends Value {
    public constructor(protected target: Value, protected type: Type) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope)
        return module.builder.CreatePointerCast(target, llvm.PointerType.get(module.Types.convertType(this.type), 0));
    }
    public toString(): string {
        return `*${this.target}`
    }
}

export type ValueNode = {
    type: Type,
    value: Value,
}

// statements
export type Statement = (
    MultiStatement |
    VariableDeclaration |
    FunctionDeclaration |
    ReturnStatement |
    SyncStatement |
    ExpressionStatement |
    IfStatement |
    WhileStatement |
    BreakStatement |
    ContinueStatement |
    ForStatement |
    ClassDeclarationStatement |
    ExportStatement |
    ImportStatement
)

export type MultiStatement = {
    type: 'multiStatement',
    statements: Statement[],
}

export type VariableDeclaration = {
    type: 'variableDeclaration',
    name: Identifier,
    value?: Value,
    valueType: Type,
}

export type FunctionDeclaration = {
    type: 'functionDeclaration',
    name: Identifier,
    params: Param[],
    returnType: Type,
    body: Statement[],
}

export type ReturnStatement = {
    type: 'returnStatement',
    value: Value,
}

export type SyncStatement = {
    type: 'syncStatement',
    lockedFields: Identifier[],
    body: Statement[],
}

export type IfStatement = {
    type: 'ifStatement',
    condition: Value,
    body: Statement[],
    elseIf?: IfStatement[],
    else?: Statement[],
}

export type WhileStatement = {
    type: 'whileStatement',
    condition: Value,
    body: Statement[],
}

export type ForStatement = {
    type: 'forStatement',
    iterable: Value,
    variable: Identifier,
    body: Statement[],
}

export type BreakStatement = {
    type: 'breakStatement',
}

export type ContinueStatement = {
    type: 'continueStatement',
}

export type ExportStatement = {
    type: 'exportStatement',
    name: Identifier,
    value: Value,
    exportType?: Type
}

// TODO: add support for imports in interpreter
export type ImportStatement = {
    type: 'importStatement',
}

export type ExpressionStatement = {
    type: 'expressionStatement',
    expression: Value,
}

// class statements
export type ClassDeclarationStatement = {
    type: 'classDeclaration',
    name: Identifier,
    body: ClassStatement[],
} 

export type ClassStatement = (
    ClassAttributeDeclaration |
    ClassFunctionDeclaration |
    ClassConstructorDeclaration
)

export type ClassAttributeDeclaration = {
    type: 'classAttributeDeclaration',
    name: Identifier,
    value?: Value,
    modifiers: Modifiers,
}

export type ClassFunctionDeclaration = {
    type: 'classFunctionDeclaration',
    name: Identifier,
    params: Param[],
    returnType: Type,
    body: Statement[],
    modifiers: Modifiers,
}

export type ClassConstructorDeclaration = {
    type: 'classConstructorDeclaration',
    params: Param[],
    body: Statement[],
}

// bindings
export type Binding = FunctionBinding

export type FunctionBinding = {
    type: 'function',
    name: string,
    params: Type[],
    returnType: Type
}

// wrapper
export type Wrappers = {
    current: Wrapper,
    parent?: Wrappers,
}

export type Wrapper = {
    returnable?: boolean,
    returnableField?: Field,
    breakable?: boolean,
    continuable?: boolean,
    class?: boolean,
}

// build
export type Build = {
    types: Types,
    callables: {[name: string]: Callable},
    imports: Binding[],
    exports: Binding[],
}

export type Environment = {
    fields: FieldEnv,
}

export type Context = {
    build: Build,
    moduleManager?: ModuleManager,
    env: Environment,
    values: Values
}

// addons
export type LexerAddon = {
    name: string,
    consumers: {
        structure?: string,
        consumer: Consumer,
    }[],
    tokenizers?: {
        [key: string]: Tokenizer
    },
    register?: {
        tokenTypes?: string[],
        symbols?: string[],
        operators?: string[],
        keywords?: string[],
        dataTypes?: string[]
    }
}

export type Consumer = {
    id?: string,
    priority?: number,
    accept: (c: string, controller: Controller) => boolean,
    willConsume: (c: string) => boolean,
    onConsume?: (c: string, controller: Controller) => void,
    onChar?: (c: string, controller: Controller) => void
}

export type Tokenizer = (value: string, controller: Controller) => SimpleToken | false

export const LexerPriority = {
    IMPORTANT: 100,
    HIGHER: 90,
    HIGH: 80,
    NORMAL: 50,
    LOW: 20,
    LOWER: 10,
    UNIMPORTANT: 0,
    more: (count: number = 1) => count * 5,
}

// util
export type Exclude<T, E> = (T extends E ? never : T) & (E extends T ? never : T)