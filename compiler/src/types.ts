export type TokenType = 'datatype' | 'identifier' | 'symbol' | 'operator' | 'keyword' | 'block'

export type Token = {
    value: string;
    type: TokenType;
    specificType?: DataType;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'void', 'any']
export const KEYWORDS: Keyword[] = ['const', 'var', 'func', 'sync', 'return', 'type']
export const OPERATORS: Operator[] = ['+', '-', '*', '/', '>', '<', '^', '%', '==', '!=', '>=', '<=', '&&', '||', '!', '=>']
export const SYMBOLS: Symbol[] = [...OPERATORS, '=', ':', ',', '.', '|']

export type LiteralDataType = 'string' | 'int' | 'float' | 'boolean'
export type DataType = LiteralDataType | 'void' | 'unknown' | 'callable' | 'object' | 'any';
export type Keyword = 'const' | 'var' | 'func' | 'sync' | 'return' | 'type';
export type Symbol =  Operator | ':' | ',' | '.' | '|' | '='
export type Operator = '+' | '-' | '*' | '/' | '>' | '<' | '^' | '%' | '==' | '!=' | '>=' | '<=' | '&&' | '||' | '!' | '=>';

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

export type Callable = {
    body: Statement[],
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

export type MapType = {
    type: 'map',
    values: Type
}

export type ArrayType = {
    type: 'array',
    items: Type
}

export type ObjectType = StructType | ArrayType | MapType

export type CallableType = {
    type: 'callable',
    params: Type[],
    returnType: Type,
}

export type PrimitiveType = {
    type: 'primitive',
    primitive: DataType
}

export type Type = PrimitiveType | UnionType | ObjectType | LiteralType | ReferenceType | CallableType

export type Types = {
    [name: string]: Type,
}

// values
export type Value = (LiteralValue | ReferenceValue | StructValue | ArrayValue | Expression)

export type LiteralValue = {
    type: 'literal',
    literal: Literal,
    literalType: LiteralDataType,
};

export type ReferenceValue = {
    type: 'reference',
    reference: string,
}

// objects
export type StructValue = {
    type: 'struct',
    properties: {[name: string]: Value},
}

export type ArrayValue = {
    type: 'array',
    items: Value[],
}

// expression
export type Expression = PlusExpression | MultiplyExpression | CallExpression | MemberExpression

export type CallExpression = {
    type: 'call',
    callable: Value,
    args: Value[],
}

export type MemberExpression = {
    type: 'member',
    target: Value,
    property: Value
}

export type PlusExpression = AddIntExpression | AddFloatExpression | ConcatStringExpression
// plus Expressions
export type AddIntExpression = {
    type: 'intAdd',
    left: Value,
    right: Value,
}

export type AddFloatExpression = {
    type: 'floatAdd',
    left: Value,
    right: Value,
}

export type ConcatStringExpression = {
    type: 'stringConcat',
    left: Value,
    right: Value,
}

export type MultiplyExpression = MultiplyIntExpression | MultiplyFloatExpression
// multiplication Expressions
export type MultiplyIntExpression = {
    type: 'intMultiply',
    left: Value,
    right: Value,
}

export type MultiplyFloatExpression = {
    type: 'floatMultiply',
    left: Value,
    right: Value,
}

export type ValueNode = {
    type: Type,
    value: Value,
}

export type Statement = VariableDeclaration | ConstantDeclaration | FunctionDeclaration | ReturnStatement | SyncStatement | ExpressionStatement

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
    body: Statement[],
}

export type ReturnStatement = {
    type: 'returnStatement',
    value: Value,
}

export type SyncStatement = {
    type: 'syncStatement',
    body: Statement[],
}

export type ExpressionStatement = {
    type: 'expressionStatement',
    expression: Value,
}

// build
export type Build = {
    types: Types,
    callables: {[name: string]: Callable}
}

export type Environment = {
    fields: FieldEnv,
}

export type LineState = {
    build: Build,
    env: Environment,
    lineIndex: number,
}