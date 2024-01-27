import llvm from "llvm-bindings";
import { Token } from "../lexer/tokens";
import LLVMModule from "../llvm-module";
import { Type, FunctionType } from "../types";

class TokenCursor {
    private _index = 0

    constructor(private readonly tokens: Token[]) {}

    protected get hasNext(): boolean {
        return this._index < this.tokens.length;
    }

    protected get next(): Token {
        return this.tokens[this._index++];
    }

    protected get peek(): Token {
        return this.tokens[this._index];
    }

    protected get previous(): Token {
        return this.tokens[this._index - 1];
    }

    protected get remaining(): Token[] {
        const result = this.tokens.slice(this._index);
        this._index = 0;
        return result;
    }

    protected until(match: (token: Token) => boolean): Token[] {
        const result: Token[] = [];
        while(this.hasNext) {
            const token = this.peek;
            if(match(token)) break;
            this.next;
            result.push(token);
        }
        return result;
    }
}

export abstract class Parser extends TokenCursor {
    constructor(tokens: Token[], protected readonly env: Environment) {
        super(tokens);
    }
}

export abstract class StatementParser extends Parser {
    public abstract parse(): Statement
}

export abstract class Statement {
    public abstract compile(module: LLVMModule): void
}

export class Borrow {
    constructor(public readonly field: Field, public readonly mutable: boolean = false) {}
}

export class Field<T extends llvm.Value = llvm.Value> {

    public constructor(public readonly type: Type) {}

    protected _ptr: T | undefined;

    public get ptr(): T {
        if(!this._ptr) throw new Error('Field has not been allocated');
        return this._ptr;
    }
}

export class VariableField extends Field<llvm.AllocaInst> {

    private constructor(
        public readonly type: Type,
        public readonly identifier: string,
        public readonly mutable: boolean,
    ) {
        super(type);
    }

    public allocate(module: LLVMModule): llvm.AllocaInst {
        if(this._ptr) throw new Error('Field has already been allocated');
        return this._ptr = module.builder.CreateAlloca(this.type.toLLVM(module), null, this.identifier);
    }

    public static from(options: {
        type: Type,
        identifier?: string,
        mutable?: boolean,
    }): VariableField {
        const identifier = options.identifier ?? `field_${Math.random().toString(36).slice(2)}`;
        const mutable = options.mutable ?? false;
        return new VariableField(options.type, identifier, mutable);
    }
}

export class FunctionField extends Field<llvm.Function> {

    private constructor(
        public readonly type: FunctionType,
        public readonly identifier: string,

    ) {
        super(type);
    }

    public allocate(module: LLVMModule): llvm.Function {
        if(this._ptr) throw new Error('Field has already been allocated');
        return this._ptr = llvm.Function.Create(this.type.toLLVM(module), llvm.Function.LinkageTypes.ExternalLinkage, this.identifier, module._module);
    }

    public static from(options: {
        type: FunctionType,
        identifier?: string,
    }): FunctionField {
        const identifier = options.identifier ?? `field_${Math.random().toString(36).slice(2)}`;
        return new FunctionField(options.type, identifier);
    }
}

export class Environment {

    public readonly fields: Map<string, Field> = new Map();

    constructor(public readonly parent?: Environment) {}

    public set(name: string, field: Field) {
        this.fields.set(name, field);
    }

    public get(name: string): Field | undefined {
        return this.fields.get(name) ?? this.parent?.get(name);
    }
}