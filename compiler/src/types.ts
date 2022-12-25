export type DataType = 'string' | 'int' | 'float' | 'void' | 'unknown' | 'any' | 'callable';
export type Keyword = 'const' | 'var' | 'func' | 'sync' | 'return';
export type Symbol = '=' | '+' | '-' | '*' | '/' | '>' | '<' | '^' | '%' | ':' | ',' | '.'

export type Token = {
    value: string;
    type: 'datatype' | 'identifier' | 'symbol' | 'keyword' | 'block';
    specificType?: DataType;
    block?: Token[][];
}

export const DATATYPES: DataType[] = ['string', 'int', 'float', 'void', 'any']
export const KEYWORDS: Keyword[] = ['const', 'var', 'func', 'sync', 'return']
export const SYMBOLS: Symbol[] = ['=', '+', '-', '*', '/', '>', '<', '^', '%', ':', ',', '.']

export type Value = string | number;
export type Identifier = string;

export type Call = {
    type: 'call',
    name: string,
    args: Argument[]
}

export type Step = (Identifier | Value | Symbol | Call)

export type Steps = {
    type: 'steps',
    value: Step[]
}

export type ValueType = 'value' | 'steps' | 'reference'

export type Argument = {
    type: 'argument',
    dataType: DataType,
    value: Value | Steps,
    valueType: ValueType
}

export type Const = {
    type: 'const',
    name: string,
    value: Value | Steps,
    valueType: ValueType
}

export type Var = {
    type: 'var',
    name: string,
    value?: Value | Steps,
    valueType: ValueType
}

export type Return = {
    type: 'return',
    value?: Value | Steps,
    valueType: ValueType
}

export type Sync = {
    type: 'sync',
    instructions: Instructions,
}

export type Param = {
    name: string,
    type: DataType,
}

export type Function = {
    params: Param[],
    returnType: DataType,
    body: Instructions,
    isSync: boolean,
}

export type Functions = {
    [name: string]: Function,
}

export type Build = {
    functions: Functions,
    types: DataType[],
    main: Instructions,
}

export type Instructions = {
    fields: FieldInstructions,
    run: (Const | Var | Sync | Return | Steps)[],
}

export type Field = {
    type: DataType,
    reference?: Identifier,
}

export type Fields = {
    [name: string]: Field
}

export type FieldInstructions = {
    parent?: FieldInstructions,
    local: Fields,
}