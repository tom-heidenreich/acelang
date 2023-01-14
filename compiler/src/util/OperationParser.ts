import { AddFloatOperation, AddIntOperation, AssignOperation, ConcatStringOperation, LineState, MultiplyFloatOperation, MultiplyIntOperation, MultiplyOperation, Operation, OperationPrototype, Operator, PlusOperation, Type, ValueNode } from "../types";
import FieldResolve from "./FieldResolve";
import TypeCheck from "./TypeCheck";

export default class OperationParser {

    public static parse(lineState:LineState, first: ValueNode, second: ValueNode, operator: Operator): {type: Type, value: Operation } {
        switch(operator) {
            case '+': {
                return handlePlus(lineState, first, second);
            }
            case '*': {
                return handleMultiply(lineState, first, second);
            }
            case '=': {
                return handleAssign(lineState, first, second);
            }
        }
        throw new Error(`Unknown operator ${operator} at line ${lineState.lineIndex}`);
    }

    public static resolvePrototype(lineState:LineState, prototype: OperationPrototype): ValueNode {
        if(!prototype.left || !prototype.right) {
            throw new Error(`Cannot resolve prototype at line ${lineState.lineIndex}`);
        }

        // resolve left and right
        if(prototype.left.type === 'prototype') {
            prototype.left = OperationParser.resolvePrototype(lineState, prototype.left);
        }
        if(prototype.right.type === 'prototype') {
            prototype.right = OperationParser.resolvePrototype(lineState, prototype.right);
        }

        const operationNode = OperationParser.parse(lineState, prototype.left, prototype.right, prototype.operator);
        return {
            type: operationNode.type,
            value: {
                type: 'operation',
                operation: operationNode.value,
            },
        }
    }

    public static getPriority(operator: Operator): number {
        switch(operator) {
            case '+': {
                return 1;
            }
            case '*': {
                return 2;
            }
            case '=': {
                return -1;
            }
        }
        throw new Error(`Unknown operator ${operator}`);
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
        },        
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
        },
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
        },
    }
}

function handleAssign(lineState: LineState, first: ValueNode, second: ValueNode): { type: Type, value: AssignOperation } {

    // first must be a field
    if(first.value.type !== 'reference') {
        throw new Error(`Cannot assign to ${first.value.type} at line ${lineState.lineIndex}`);
    }
    const field = FieldResolve.resolve(lineState.env.fields, first.value.reference);
    if(!field) {
        throw new Error(`Cannot find field ${first.value.reference} at line ${lineState.lineIndex}`);
    }

    // second must be the same type as the field
    if(!TypeCheck.matches(lineState.build.types, second.type, field.type)) {
        throw new Error(`Cannot assign ${TypeCheck.stringify(second.type)} to ${TypeCheck.stringify(field.type)} at line ${lineState.lineIndex}`);
    }

    return {
        // TODO: should be void
        // type: {
        //     type: 'primitive',
        //     primitive: 'void',
        // },
        type: second.type,
        value: {
            type: 'assign',
            left: field,
            right: second.value,
        },
    }
}

function handleMultiply(lineState: LineState, first: ValueNode, second: ValueNode): { type: Type, value: MultiplyOperation } {
    const firstType = TypeCheck.resolvePrimitive(lineState.build.types, first.type);
    const secondType = TypeCheck.resolvePrimitive(lineState.build.types, second.type);

    if(firstType === 'int' && secondType === 'int') {
        return handleIntMultiply(first, second);
    }
    else if((firstType === 'float' || firstType === 'int') && (secondType === 'float' || secondType === 'int')) {
        return handleFloatMultiply(first, second);
    }
    else {
        throw new Error(`Cannot multiply ${firstType} and ${secondType} at line ${lineState.lineIndex}`);
    }
}

function handleIntMultiply(first: ValueNode, second: ValueNode): { type: Type, value: MultiplyIntOperation } {
    return {
        type: {
            type: 'primitive',
            primitive: 'int',
        },
        value: {
            type: 'intMultiply',
            left: first.value,
            right: second.value,
        },
    }
}

function handleFloatMultiply(first: ValueNode, second: ValueNode): { type: Type, value: MultiplyFloatOperation } {
    return {
        type: {
            type: 'primitive',
            primitive: 'float',
        },
        value: {
            type: 'floatMultiply',
            left: first.value,
            right: second.value,
        },
    }
}