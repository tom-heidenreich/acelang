export type Token = {
    value: string;
    type: 'datatype' | 'identifier' | 'symbol' | 'operator' | 'keyword' | 'block';
    specificType?: DataType;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'void', 'any']
export const KEYWORDS: Keyword[] = ['const', 'var', 'func', 'sync', 'return', 'type']
export const SYMBOLS: Symbol[] = ['=', ':', ',', '.', '|']
export const OPERATORS: Operator[] = ['+', '-', '*', '/', '>', '<', '^', '%', '==', '!=', '>=', '<=', '&&', '||', '!']

export type DataType = 'string' | 'int' | 'float' | 'void' | 'unknown' | 'callable' | 'object' | 'any';
export type Keyword = 'const' | 'var' | 'func' | 'sync' | 'return' | 'type';
export type Symbol = '=' | ':' | ',' | '.' | '|'
export type Operator = '+' | '-' | '*' | '/' | '>' | '<' | '^' | '%' | '==' | '!=' | '>=' | '<=' | '&&' | '||' | '!' ;

export type Identifier = string;
export type Primitive = string | number | boolean;
export type Key = string | number;

// keywords
export type Const = {
    type: 'const',
    name: string,
    value: Value,
}

export type Var = {
    type: 'var',
    name: string,
    value?: Value,
}

export type Return = {
    type: 'return',
    value?: Value,
}

export type Sync = {
    type: 'sync',
    instructions: Instructions,
}

// functions
export type Param = {
    name: string,
    type: Type,
}

export type Function = {
    params: Param[],
    returnType: Type,
    body: Instructions,
    isSync: boolean,
}

export type Functions = {
    [name: string]: Function,
}

// fields
export type Field = {
    type: Type,
    reference?: Identifier,
}

export type Fields = {
    [name: string]: Field
}

export type FieldInstructions = {
    parent?: FieldInstructions,
    local: Fields,
}

// types
export type ReferenceType = {
    type: 'reference',
    reference: Identifier
}

export type LiteralType = {
    type: 'literal',
    literal: Primitive
}

export type UnionType = {
    type: 'union',
    oneOf: Type[]
}

export type StructType = {
    type: 'struct',
    properties: Types
}

export type ArrayType = {
    type: 'array',
    items: Type
}

export type ObjectType = StructType | ArrayType

export type PrimitiveType = {
    type: 'primitive',
    primitive: DataType
}

export type Type = (PrimitiveType | UnionType | ObjectType | LiteralType | ReferenceType)

export type Types = {
    [name: string]: Type,
}

// values
export type Value = (PrimitiveValue | Execution | Reference | Struct | ArrayValue)
export type ValueResult = {
    value: Value,
    type: Type,
}

export type PrimitiveValue = {
    type: 'primitive',
    primitive: Primitive
};

export type Reference = {
    type: 'reference',
    reference: string,
}

// steps
export type Steps = {
    type: 'steps',
    value: Step[]
}
export type Step = Operation

// operations
export type Operation = PlusOperation

export type PlusOperation = AddInt | AddFloat | ConcatString
export type AddInt = {
    type: 'intAdd',
    left: Execution,
    right: Execution,
}

export type AddFloat = {
    type: 'floatAdd',
    left: Execution,
    right: Execution,
}

export type ConcatString = {
    type: 'stringConcat',
    left: Execution,
    right: Execution,
}

// objects
export type Struct = {
    type: 'struct',
    properties: {[name: string]: Value},
}

export type ArrayValue = {
    type: 'array',
    items: Value[],
}

// execution
export type Execution = PrimitiveValue | Executable | Operation
export type Executable = Call | Access | Set

export type ExecutionResult = {
    type: Type,
    value: Execution,
}

export type Call = {
    type: 'call',
    address: Identifier,
    args: Value[]
}

export type Access = {
    type: 'access',
    address: Identifier,
    key: Primitive,
}

export type Set = {
    type: 'set',
    address: Identifier,
    value: Value,
}

// build
export type Build = {
    functions: Functions,
    types: Types,
    main: Instructions,
}

export type Instructions = {
    fields: FieldInstructions,
    run: (Const | Var | Sync | Return | Executable)[],
}