import { AddFloatOperation, AddIntOperation, ConcatStringOperation, LineState, Operation, Operator, PlusOperation, Type, ValueResult } from "../types";
import TypeCheck from "./TypeCheck";

export default class OperationParser {

    public static parse(lineState:LineState, first: ValueResult, second: ValueResult, operator: Operator): {type: Type, value: Operation } {
        switch(operator) {
            case '+': {
                return handlePlus(lineState, first, second);
            }
        }
        throw new Error(`Unknown operator ${operator} at line ${lineState.lineIndex}`);
    }
}

function handlePlus(lineState: LineState, first: ValueResult, second: ValueResult): { type: Type, value: PlusOperation } {
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

function handleIntAdd(first: ValueResult, second: ValueResult): { type: Type, value: AddIntOperation } {
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

function handleFloatAdd(first: ValueResult, second: ValueResult): { type: Type, value: AddFloatOperation } {
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

function handleStringConcat(first: ValueResult, second: ValueResult): { type: Type, value: ConcatStringOperation } {
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