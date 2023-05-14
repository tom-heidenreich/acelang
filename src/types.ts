import llvm from "llvm-bindings";
import { Scope } from "./compiler/compiler";
import LLVMModule from "./compiler/llvm-module";
import { Controller } from "./lexer";
import { ModuleManager } from "./modules";
import Values from "./values";
import { randomUUID } from "crypto";

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
    'return',
    'throw',
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
    'declare',
    'null'
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
    'return' |
    'throw' |
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
    'declare' |
    'null'
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
    isConst?: boolean,
    preferredName?: string,
    globalPointerName?: string,
    useGlobalRef?: boolean,
}

// scope
export class ParserScope {

    public readonly id: string

    public readonly global: Map<string, Field>
    private readonly parent?: ParserScope

    private local: Map<string, Field> = new Map();

    constructor({ global, parent, isRoot }: { global?: Map<string, Field>, parent?: ParserScope, isRoot?: boolean }) {
        this.id = randomUUID();

        this.parent = parent;
        if(!global) {
            if(!parent) {
                if(!isRoot) throw new Error("Global scope is required");
                this.global = new Map();
            }
            else this.global = parent.global;
        }
        else this.global = global;
    }

    public get(name: string): Field | undefined {
        const local = this.local.get(name);
        if(local) return local;
        if(this.parent) return this.parent.get(name);
        return this.global.get(name);
    }

    public getNotGlobal(name: string): Field | undefined {
        const local = this.local.get(name);
        if(local) return local;
        if(this.parent) return this.parent.getNotGlobal(name);
        return undefined;
    }

    public getLocal(name: string): Field | undefined {
        return this.local.get(name);
    }

    public set(name: string, field: Field) {
        this.local.set(name, field);
    }

    public setGlobal(name: string, field: Field) {
        if(this.parent) this.parent.setGlobal(name, field);
        else this.global.set(name, field);
    }

    public has(name: string): boolean {
        if(this.local.has(name)) return true;
        if(this.parent) return this.parent.has(name);
        return this.global.has(name);
    }
}

export abstract class AccessProxyScope extends ParserScope {

    constructor(protected readonly scope: ParserScope) {
        super({ global: scope.global })
    }

    public get(name: string): Field | undefined {
        const field = this.getNotGlobal(name);
        if(field) return field;
        return this.scope.global.get(name);
    }

    public getNotGlobal(name: string): Field | undefined {
        return this.handleAccess(name);
    }

    public getLocal(name: string): Field | undefined {
        throw new Error("Cannot get local field in access proxy scope");
    }

    public set() {
        throw new Error("Cannot set field in access proxy scope");
    }

    public setGlobal() {
        throw new Error("Cannot set field in access proxy scope");
    }

    public has(name: string) {
        console.log('has', name);
        return this.scope.has(name);
    }

    protected abstract handleAccess(name: string): Field | undefined
}

export class ReplaceRefWithGlobalScope extends AccessProxyScope {

    private readonly collectedAccesses: Set<{
        name: string,
        globalRef: string
        type: Type
    }> = new Set();

    public get collected() {
        return Array.from(this.collectedAccesses);
    }

    protected handleAccess(name: string): Field | undefined {
        const field = this.scope.getNotGlobal(name);
        if(!field) return undefined;
        const globalPointerName = field.globalPointerName || `${name}_${randomUUID().replace(/-/g, '')}`
        this.collectedAccesses.add({
            name,
            globalRef: globalPointerName,
            type: field.type,
        });
        field.globalPointerName = globalPointerName;
        return {
            ...field,
            useGlobalRef: true,
        }
    }
}

// functions
export type Param = {
    name: string,
    type: Type,
}

export type Callable = {
    name: string,
    body: Statement[],
    params: Param[],
    returnType: Type,
    // TODO: rename this. imports uses this too
    isBuiltIn?: boolean,
}

// globals
export type Global = {
    type: Type,
    isConst?: boolean,
    value?: Value,
}

// types
export abstract class Type {

    constructor(private isNullable: boolean) {}

    public get nullable(): boolean {
        return this.isNullable;
    }

    public setIsNullable(value: boolean) {
        this.isNullable = value;
    }

    public abstract matches(type: Type): boolean;

    public abstract toLLVM(module: LLVMModule): llvm.Type;
    public abstract toString(): string;

    public get dereference(): Type {
        if(this instanceof PointerType) return this.pointer;
        return this;
    }
}

export abstract class ObjectType extends Type {
    public abstract getPropertyAt(key: LiteralValue): Type | undefined;
}

export class StructType extends ObjectType {

    constructor(public properties: Types, nullable: boolean = false) {
        super(nullable)
    }

    public matches(type: Type): boolean {
        if(!(type instanceof StructType)) return false;
        const entries = Object.entries(this.properties);
        const otherEntries = Object.entries(type.properties);
        if(entries.length !== otherEntries.length) return false;
        for(let i = 0; i < entries.length; i++) {
            const [name, type] = entries[i];
            const [otherName, otherType] = otherEntries[i];
            if(name !== otherName) return false;
            if(!type.matches(otherType)) return false;
        }
        return true;
    }

    public getPropertyAt(key: LiteralValue): Type | undefined {
        if(key.literalType === 'string') return this.properties[key.literal.toString()];
        else if(key.literalType === 'int') {
            const keys = Object.keys(this.properties);
            return this.properties[keys[key.literal as number]];
        }
        return undefined;
    }

    public toLLVM(module: LLVMModule): llvm.StructType {
        const types = Object.entries(this.properties).map(([_, type]) => type.toLLVM(module));
        return llvm.StructType.get(module._context, types);
    }

    public toString(): string {
        return `{${Object.entries(this.properties).map(([name, type]) => `${name}: ${type}`).join(', ')}}`
    }
}

export class ArrayType extends ObjectType {

    constructor(public items: Type, public size: number, nullable: boolean = false) {
        super(nullable)
    }

    public matches(type: Type): boolean {
        if(!(type instanceof ArrayType)) return false;
        return this.items.matches(type.items) && this.size === type.size;
    }

    public getPropertyAt(key: LiteralValue): Type | undefined {
        if(key.literalType !== 'int') return undefined;
        return this.items;
    }

    public toLLVM(module: LLVMModule): llvm.ArrayType {
        return llvm.ArrayType.get(this.items.toLLVM(module), this.size);
    }

    public toString(): string {
        return `[${this.items} x ${this.size}]`
    }
}

export class CallableType extends Type {

    constructor(public params: Type[], public returnType: Type, nullable: boolean = false) {
        super(nullable)
    }

    public matches(type: Type): boolean {
        if(!(type instanceof CallableType)) return false;
        if(!this.returnType.matches(type.returnType)) return false;
        if(this.params.length !== type.params.length) return false;
        for(let i = 0; i < this.params.length; i++) {
            if(!this.params[i].matches(type.params[i])) return false;
        }
        return true;
    }

    public toLLVM(module: LLVMModule): llvm.Type {
        return llvm.FunctionType.get(
            this.returnType.toLLVM(module), this.params.map(param => param.toLLVM(module)), false);
    }

    public toString(): string {
        return `((${this.params.join(', ')}) => ${this.returnType})`
    }
}

export abstract class PrimitiveType extends Type {

    constructor(nullable: boolean = false) {
        super(nullable)
    }

    public abstract get primitive(): DataType
}

export class IntType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt32Ty();
    }

    public matches(type: Type): boolean {
        return type instanceof IntType;
    }

    public toString(): string {
        return `int`
    }

    public get primitive(): DataType {
        return 'int'
    }
}

export class FloatType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getDoubleTy();
    }

    public matches(type: Type): boolean {
        return type instanceof FloatType;
    }

    public toString(): string {
        return `float`
    }

    public get primitive(): DataType {
        return 'float'
    }
}

export class StringType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt8PtrTy();
    }

    public matches(type: Type): boolean {
        return type instanceof StringType;
    }
    
    public toString(): string {
        return `string`
    }

    public get primitive(): DataType {
        return 'string'
    }
}

export class BooleanType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getInt1Ty();
    }

    public matches(type: Type): boolean {
        return type instanceof BooleanType;
    }

    public toString(): string {
        return `boolean`
    }

    public get primitive(): DataType {
        return 'boolean'
    }
}

export class VoidType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        return module.builder.getVoidTy();
    }

    public matches(type: Type): boolean {
        return type instanceof VoidType;
    }

    public toString(): string {
        return `void`
    }

    public get primitive(): DataType {
        return 'void'
    }
}

export class UnknownType extends PrimitiveType {

    public toLLVM(module: LLVMModule): llvm.Type {
        throw new Error("Unknown type cannot be compiled");
    }

    public matches(type: Type): boolean {
        return true;
    }

    public toString(): string {
        return `unknown`
    }

    public get primitive(): DataType {
        return 'unknown'
    }
}

export class PointerType extends Type {

    constructor(public pointer: Type, nullable: boolean = false) {
        super(nullable)
    }

    public matches(type: Type): boolean {
        if(!(type instanceof PointerType)) return false;
        return this.pointer.matches(type.pointer);
    }

    public toLLVM(module: LLVMModule): llvm.Type {
        return llvm.PointerType.get(this.pointer.toLLVM(module), 0);
    }

    public toString(): string {
        return `${this.pointer}*`
    }

    public get nullable(): boolean {
        return this.pointer.nullable;
    }
}

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
export abstract class LiteralValue extends Value {
    public abstract get literal(): Literal;
    public abstract get literalType(): LiteralDataType;
}

export class IntValue extends LiteralValue {
    constructor(private value: number) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.int(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
    public get literal(): Literal {
        return this.value
    }
    public get literalType(): LiteralDataType {
        return 'int'
    }
}

export class FloatValue extends LiteralValue {
    constructor(private value: number) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.float(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
    public get literal(): Literal {
        return this.value
    }
    public get literalType(): LiteralDataType {
        return 'float'
    }
}

export class StringValue extends LiteralValue {
    constructor(private value: string) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.string(this.value)
    }
    public toString(): string {
        return this.value
    }
    public get literal(): Literal {
        return this.value
    }
    public get literalType(): LiteralDataType {
        return 'string'
    }
}

export class BooleanValue extends LiteralValue {
    constructor(private value: boolean) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return module.Values.bool(this.value)
    }
    public toString(): string {
        return this.value.toString()
    }
    public get literal(): Literal {
        return this.value
    }
    public get literalType(): LiteralDataType {
        return 'boolean'
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
        const type = structType.toLLVM(module);

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
        const arrayType = new ArrayType(this.itemType, this.items.length).toLLVM(module);

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
    constructor(private name: string, private collected: { name: string, globalRef: string, type: Type }[]) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        
        for(const { name, globalRef } of this.collected) {

            const ref = scope.get(name);
            if(!ref) throw new Error(`Unexpected error. Reference ${name} not found`);

            const globalRefValue = scope.get(globalRef);
            if(!globalRefValue) throw new Error(`Unexpected error. Global reference ${globalRef} not found`);

            module.builder.CreateStore(ref, globalRefValue);
        }
        
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
        return module.builder.CreateGEP(this.targetType.toLLVM(module), target, [module.Values.int(0), property]);
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
        return module.builder.CreatePointerCast(target, llvm.PointerType.get(this.type.toLLVM(module), 0));
    }
    public toString(): string {
        return `*${this.target}`
    }
}

export class NegValue extends Value {
    public constructor(protected target: Value) {
        super()
    }
    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        const target = this.target.compile(module, scope)
        return module.builder.CreateNeg(target);
    }
    public toString(): string {
        return `-${this.target}`
    }
}

export interface TypeRequired {
    setType(type: Type): void
}

export function instanceOf(instance: any, type: 'TypeRequired') {
    switch(type) {
        case 'TypeRequired': {
            if(!('setType' in instance)) return false;
            return typeof instance.setType === 'function';
        }
    }
}

export class NullValue extends Value implements TypeRequired {

    constructor(private type: Type) {
        super()
    }

    public setType(type: Type): void {
        this.type = type;
    }

    public compile(module: LLVMModule, scope: Scope): llvm.Value {
        return llvm.Constant.getNullValue(this.type.toLLVM(module))
    }

    public toString(): string {
        return `null`
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
    ThrowStatement |
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
    value?: Value,
}

export type ThrowStatement = {
    type: 'throwStatement',
    value: Value,
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
    globals: {[name: string]: Global},
}

export type Context = {
    build: Build,
    moduleManager?: ModuleManager,
    scope: ParserScope,
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
    willConsume: (c: string, controller: Controller) => boolean,
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