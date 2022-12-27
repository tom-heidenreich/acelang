import { AddFloat, AddInt, Build, ConcatString, ExecutionResult, Operation, Operator, PlusOperation, Type } from "../types";
import TypeCheck from "./TypeCheck";

export default class OperationParser {

    public static parse(build: Build, first: ExecutionResult, second: ExecutionResult, operator: Operator, lineIndex: number): {type: Type, value: Operation } {
        switch(operator) {
            case '+': {
                return handlePlus(build, first, second, lineIndex);
            }
        }
        throw new Error(`Unknown operator ${operator} at line ${lineIndex}`);
    }
}

function handlePlus(build: Build, first: ExecutionResult, second: ExecutionResult, lineIndex: number): { type: Type, value: PlusOperation } {
    const firstType = TypeCheck.resolvePrimitive(build.types, first.type);
    const secondType = TypeCheck.resolvePrimitive(build.types, second.type);

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
        throw new Error(`Cannot add ${firstType} and ${secondType} at line ${lineIndex}`);
    }
}

function handleIntAdd(first: ExecutionResult, second: ExecutionResult): { type: Type, value: AddInt } {
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

function handleFloatAdd(first: ExecutionResult, second: ExecutionResult): { type: Type, value: AddFloat } {
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

function handleStringConcat(first: ExecutionResult, second: ExecutionResult): { type: Type, value: ConcatString } {
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