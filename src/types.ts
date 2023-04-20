import { Controller } from "./lexer";
import { ModuleManager } from "./modules";

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
export type Value = (LiteralValue | UndefinedValue | ReferenceValue | StructValue | ArrayValue | Expression | DereferenceValue | PointerCastValue | ArrowFunctionValue)

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
    itemType: Type,
}

export type DereferenceValue = {
    type: 'dereference',
    target: Value,
    targetType: Type,
}

export type PointerCastValue = {
    type: 'pointerCast',
    target: Value,
    targetType: Type,
}

export type ArrowFunctionValue = {
    type: 'arrowFunction',
    name: string
}

// expression
export type Expression = (
    PlusExpression |
    MinusExpression |
    MultiplyExpression |
    DivideExpression |
    CallExpression |
    MemberExpression |
    ConditionalExpression |
    InstantiationExpression |
    CastExpression |
    AssignExpression
)

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
    targetType: Type,
    target: Value,
    property: Value
}

export type AssignExpression = {
    type: 'assign',
    target: Value,
    value: Value,
}

export type PlusExpression = AddExpression | ConcatStringExpression
// plus Expressions
export type AddExpression = {
    type: 'add',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

export type ConcatStringExpression = {
    type: 'stringConcat',
    left: Value,
    right: Value,
}

// minus Expressions
export type MinusExpression = SubtractExpression
export type SubtractExpression = {
    type: 'subtract',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

// multiplication Expressions
export type MultiplyExpression = {
    type: 'multiply',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

// division Expressions
export type DivideExpression = {
    type: 'divide',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

// conditional Expressions
export type ConditionalExpression = EqualsExpression | ComparisonExpression

export type EqualsExpression = {
    type: 'equals',
    left: Value,
    right: Value,
}

// comparison Expressions
export type ComparisonExpression = (
    LessThanExpression |
    LessThanEqualsExpression |
    GreaterThanExpression |
    GreaterThanEqualsExpression
)

export type LessThanExpression = {
    type: 'lessThan',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

export type LessThanEqualsExpression = {
    type: 'lessThanEquals',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

export type GreaterThanExpression = {
    type: 'greaterThan',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}


export type GreaterThanEqualsExpression = {
    type: 'greaterThanEquals',
    left: Value,
    right: Value,
    numberType: 'int' | 'float',
}

// cast Expressions
export type CastExpression = {
    type: 'cast',
    value: Value,
    targetType: DataType,
    currentType: DataType,
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