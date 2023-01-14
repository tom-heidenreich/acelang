export type TokenType = 'datatype' | 'identifier' | 'symbol' | 'operator' | 'keyword' | 'block'

export type Token = {
    value: string;
    type: TokenType;
    specificType?: DataType;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'void', 'any']
export const KEYWORDS: Keyword[] = ['const', 'var', 'func', 'sync', 'return', 'type']
export const OPERATORS: Operator[] = ['=', '+', '-', '*', '/', '>', '<', '^', '%', '==', '!=', '>=', '<=', '&&', '||', '!', '=>']
export const SYMBOLS: Symbol[] = [...OPERATORS, ':', ',', '.', '|']

export type DataType = 'string' | 'int' | 'float' | 'void' | 'unknown' | 'callable' | 'object' | 'any';
export type Keyword = 'const' | 'var' | 'func' | 'sync' | 'return' | 'type';
export type Symbol =  Operator | ':' | ',' | '.' | '|'
export type Operator = '=' | '+' | '-' | '*' | '/' | '>' | '<' | '^' | '%' | '==' | '!=' | '>=' | '<=' | '&&' | '||' | '!' | '=>';

export type Identifier = string;
export type Literal = string | number | boolean;
export type Key = string | number;

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

export type Function = {
    params: Param[],
    returnType: Type,
    body: Node[],
    isSync: boolean,
}

// types
export type ReferenceType = {
    type: 'reference',
    reference: Identifier
}

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
export type Value = (LiteralValue | Reference | Struct | ArrayValue | CallValue | OperationValue)

export type LiteralValue = {
    type: 'literal',
    literal: Literal
};

export type Reference = {
    type: 'reference',
    reference: string,
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

// call
export type CallValue = {
    type: 'call',
    args: Value[],
    reference: Identifier,
}

// operation
export type OperationValue = {
    type: 'operation',
    operation: Operation,
}

export type Operation = AssignOperation | PlusOperation | MultiplyOperation

export type PrototypeValue = ValueNode | OperationPrototype
export type OperationPrototype = {
    type: 'prototype',
    operator: Operator,
    left?: PrototypeValue,
    right?: PrototypeValue,
}

export type AssignOperation = {
    type: 'assign',
    left: Field,
    right: Value,
}

export type PlusOperation = AddIntOperation | AddFloatOperation | ConcatStringOperation
// plus operations
export type AddIntOperation = {
    type: 'intAdd',
    left: Value,
    right: Value,
}

export type AddFloatOperation = {
    type: 'floatAdd',
    left: Value,
    right: Value,
}

export type ConcatStringOperation = {
    type: 'stringConcat',
    left: Value,
    right: Value,
}

export type MultiplyOperation = MultiplyIntOperation | MultiplyFloatOperation
// multiplication operations
export type MultiplyIntOperation = {
    type: 'intMultiply',
    left: Value,
    right: Value,
}

export type MultiplyFloatOperation = {
    type: 'floatMultiply',
    left: Value,
    right: Value,
}

// ast
export type Program = Node[]

// nodes
export type ASTNode = VariableDeclaration | ConstantDeclaration | FunctionDeclaration | ReturnStatement | Value

export type ValueNode = {
    type: Type,
    value: Value,
}

export type Node = ValueNode | ASTNode

export type VariableDeclaration = {
    type: 'variableDeclaration',
    name: Identifier,
    value?: Value,
}

export type ConstantDeclaration = {
    type: 'constantDeclaration',
    name: Identifier,
    value: Value,
}

export type FunctionDeclaration = {
    type: 'functionDeclaration',
    name: Identifier,
    params: Param[],
    returnType: Type,
    body: Program,
}
export type ReturnStatement = {
    type: 'returnStatement',
    value: Value,
}

// build
export type Build = {
    types: Types,
    functions: {[name: string]: Function}
}

export type Environment = {
    fields: FieldEnv,
}

export type LineState = {
    build: Build,
    env: Environment,
    lineIndex: number,
}