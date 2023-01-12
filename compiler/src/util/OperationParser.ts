import { AddFloatOperation, AddIntOperation, AssignOperation, ConcatStringOperation, LineState, Operation, Operator, PlusOperation, Type, ValueNode } from "../types";
import FieldResolve from "./FieldResolve";
import TypeCheck from "./TypeCheck";

export default class OperationParser {

    public static parse(lineState:LineState, first: ValueNode, second: ValueNode, operator: Operator): {type: Type, value: Operation } {
        switch(operator) {
            case '+': {
                return handlePlus(lineState, first, second);
            }
            case '=': {
                return handleEquals(lineState, first, second);
            }
        }
        throw new Error(`Unknown operator ${operator} at line ${lineState.lineIndex}`);
    }
}

function handlePlus(lineState: LineState, first: ValueNode, second: ValueNode): { type: Type, value: PlusOperation } {
    const firstType = TypeCheck.resolvePrimitive(lineState.build.types, first.type);
    const secondType = TypeCheck.resolvePrimitive(lineState.build.types, second.type);

    if(firstType === 'int' && secondType === 'int') {
        return handleIntAdd(first, second);
    }
    else if((firstType === 'float' || firstType === 'int') && (secondType === 'float' || secondType === 'int')) {
        return handleFloatAdd(first, second);
    }
    else if(firstType === 'string' || secondType === 'string') {
        return handleStringConcat(first, second);
    }
    else {
        throw new Error(`Cannot add ${firstType} and ${secondType} at line ${lineState.lineIndex}`);
    }
}

function handleIntAdd(first: ValueNode, second: ValueNode): { type: Type, value: AddIntOperation } {
    return {
        type: {
            type: 'primitive',
            primitive: 'int',
        },
        value: {
            type: 'intAdd',
            left: first.value,
            right: second.value,
        }
    }
}

function handleFloatAdd(first: ValueNode, second: ValueNode): { type: Type, value: AddFloatOperation } {
    return {
        type: {
            type: 'primitive',
            primitive: 'float',
        },
        value: {
            type: 'floatAdd',
            left: first.value,
            right: second.value,
        }
    }
}

function handleStringConcat(first: ValueNode, second: ValueNode): { type: Type, value: ConcatStringOperation } {
    return {
        type: {
            type: 'primitive',
            primitive: 'string',
        },
        value: {
            type: 'stringConcat',
            left: first.value,
            right: second.value,
        }
    }
}

function handleEquals(lineState: LineState, first: ValueNode, second: ValueNode): { type: Type, value: AssignOperation } {
    
    // first has to be a field
    if(first.value.type !== 'reference') {
        throw new Error(`Expected field reference at line ${lineState.lineIndex}`)
    }
    const field = FieldResolve.resolve(lineState.env.fields, first.value.reference);
    if(!field) {
        throw new Error(`Cannot find field ${first.value.reference} at line ${lineState.lineIndex}`);
    }

    // second has to be the same type as the field
    if(!TypeCheck.matches(lineState.build.types, field.type, second.type)) {
        throw new Error(`Type mismatch at line ${lineState.lineIndex}`);
    }

    return {
        type: field.type,
        value: {
            type: 'assign',
            left: field,
            right: second.value,
        }
    }
}