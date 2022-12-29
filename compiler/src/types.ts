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

// fields
export type Field = {
    type: Type,
    address: Identifier
}

export type Fields = {
    [name: string]: Field
}

export type FieldEnv = {
    parent?: FieldEnv,
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
export type Value = (PrimitiveValue | Reference | Struct | ArrayValue | Steps)
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

// objects
export type Struct = {
    type: 'struct',
    properties: {[name: string]: Value},
}

export type ArrayValue = {
    type: 'array',
    items: Value[],
}

// steps
export type Steps = {
    type: 'steps',
}

// runnable
export type Runnable = Malloc | Move | Assign

export type Malloc = {
    type: 'malloc',
    address: Identifier,
    size: number,
}

export type Move = {
    type: 'move',
    from: Value,
    to: Value,
}

export type Assign = {
    type: 'assign',
    address: Identifier,
    data: Uint8Array,
    debug?: string,
}

// build
export type Build = {
    types: Types,
    main: Environment,
}

export type Environment = {
    fields: FieldEnv,
    run: Runnable[],
}