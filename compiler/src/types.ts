export type TokenType = 'datatype' | 'identifier' | 'symbol' | 'operator' | 'keyword' | 'modifier' | 'block'

export type Token = {
    value: string;
    type: TokenType;
    specificType?: DataType;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'void', 'any', 'undefined']
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
]
export const MODIFIERS: Modifier[] = ['public', 'private', 'static', 'abstract']
export const OPERATORS: Operator[] = ['+', '-', '*', '/', '>', '<', '^', '%', '==', '!=', '>=', '<=', '&&', '||', '!', '=>']
export const SYMBOLS: Symbol[] = [...OPERATORS, '=', ':', ',', '.', '|', '?']

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
    'as'
)
export type Modifier = 'public' | 'private' | 'static' | 'abstract';
export type Symbol =  Operator | ':' | ',' | '.' | '|' | '=' | '?'
export type Operator = '+' | '-' | '*' | '/' | '>' | '<' | '^' | '%' | '==' | '!=' | '>=' | '<=' | '&&' | '||' | '!' | '=>';

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

export type ObjectType = {
    type: 'object',
    values: Type
}

export type ArrayType = {
    type: 'array',
    items: Type
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

export type Type = PrimitiveType | UnionType | StructType | ArrayType | ObjectType | LiteralType | ReferenceType | CallableType | ClassType

export type Types = {
    [name: string]: Type,
}

// values
export type Value = (LiteralValue | UndefinedValue | ReferenceValue | StructValue | ArrayValue | Expression)

export type LiteralValue = {
    type: 'literal',
    literal: Literal,
    literalType: LiteralDataType,
};

export type UndefinedValue = {
    type: 'undefined',
}

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
export type Expression = PlusExpression | MultiplyExpression | CallExpression | MemberExpression | EqualsExpression | InstantiationExpression

export type CallExpression = {
    type: 'call',
    callable: Value,
    args: Value[],
}

export type InstantiationExpression = {
    type: 'instantiation',
    className: Identifier,
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

export type EqualsExpression = {
    type: 'equals',
    left: Value,
    right: Value,
}

export type ValueNode = {
    type: Type,
    value: Value,
}

// statements
export type Statement = (
    MultiStatement |
    VariableDeclaration |
    ConstantDeclaration |
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
    ExportStatement
)

export type MultiStatement = {
    type: 'multiStatement',
    statements: Statement[],
}

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