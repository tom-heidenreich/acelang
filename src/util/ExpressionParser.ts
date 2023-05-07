import { AddExpression, AssignExpression, BooleanToFloatCast, BooleanToIntCast, CallExpression, ConcatStringExpression, Context, DereferenceValue, DivideExpression, EqualsExpression, FloatGreaterThanEqualsExpression, FloatGreaterThanExpression, FloatLessThanEqualsExpression, FloatLessThanExpression, FloatToBooleanCast, FloatToIntCast, IntGreaterThanEqualsExpression, IntGreaterThanExpression, IntLessThanEqualsExpression, IntLessThanExpression, IntToBooleanCast, IntToFloatCast, IntValue, MemberExpression, MultiplyExpression, Operator, PointerCastValue, PrimitiveType, ReferenceValue, SubtractExpression, Token, Type, Value, ValueNode } from "../types";
import Cursor, { WriteCursor } from "./cursor";
import TypeCheck from "./TypeCheck";
import FieldResolve from "./FieldResolve";
import { parseType } from "../parser/types";
import Logger from "./logger";
import line from "./LineStringify";
import { parseArrowFunction } from "../parser/functions";
import LLVMModule from "../compiler/llvm-module";
import { Scope } from "../compiler/compiler";
import llvm from "llvm-bindings";

function dereference(context: Context, target: ValueNode, token: Token): ValueNode {
    const { type, value } = target;
    if(type.type !== 'pointer') {
        throw new Error(`Expected pointer, got ${TypeCheck.stringify(type)} at ${line(token)}`);
    }
    return {
        type: type.pointer,
        value: new DereferenceValue(value)
    }
}

function pointerCast(context: Context, target: ValueNode, token: Token): ValueNode {
    const { type, value } = target;
    return {
        type: {
            type: 'pointer',
            pointer: type
        },
        value: new PointerCastValue(value, type)
    }
}

export default class ExpressionParser {

    public static parse(context: Context, cursor: Cursor<Token>): ValueNode {

        if(cursor.done) throw new Error(`Invalid expression at ${line(cursor.peekLast())}`)
        else if (cursor.hasOnlyOne()) return context.values.parseValue(context, cursor);

        let mainOperatorIndex = -1;
        let mainOperator: Operator | undefined;
        let mainOperatorPrecedence = -1;

        const leftCursor = new WriteCursor<Token>();
        const rightCursor = new WriteCursor<Token>();

        let index = 0
        while(!cursor.done) {

            const token = cursor.next();

            if(token.type === 'operator') {

                const operator = token.value as Operator;
                const precedence = ExpressionParser.getPrecedence(operator);

                if(precedence > mainOperatorPrecedence) {
                    mainOperatorIndex = index;
                    mainOperator = operator
                    mainOperatorPrecedence = precedence;
                }
            }
            index++;
        }

        if(mainOperatorIndex === -1) {
            // no operators found, but we have more than one token
            return parseOperatorlessExpression(context, cursor.reset());
        }
        // prefix operator
        else if(mainOperatorIndex === 0) {
            if(mainOperator === '$') {
                // dereference
                const resetCursor = cursor.reset();
                const next = resetCursor.next();
                const value = context.values.parseValue(context, cursor.remaining());
                return dereference(context, value, next);
            }
            else if(mainOperator === '*') {
                // pointer
                const resetCursor = cursor.reset();
                const next = resetCursor.next();
                const value = context.values.parseValue(context, cursor.remaining());
                return pointerCast(context, value, next);
            }
        }
        else if(mainOperatorIndex === 0 || mainOperatorIndex === index - 1) {
            throw new Error(`Operator ${mainOperator} at ${line(cursor.peekLast())} cannot be used as prefix or suffix`);
        }

        // split the cursor into left and right
        cursor.reset();
        for(let i = 0; i < mainOperatorIndex; i++) leftCursor.push(cursor.next());
        cursor.next();
        while(!cursor.done) rightCursor.push(cursor.next());

        // special operators
        switch(mainOperator) {
            case '=>': return parseArrowFunction(context, leftCursor.toReadCursor(), rightCursor.toReadCursor());
        }

        const left = this.parse(context, leftCursor.toReadCursor());
        const right = this.parse(context, rightCursor.toReadCursor());
        return this.parseOperator(context, mainOperator!, left, right, cursor.peekLast());
    }

    private static getPrecedence(op: Operator): number {
        switch(op) {
            case '$': return 0;
            case '+': return 2;
            case '*': return 1;
            case '/': return 1;
            case '=': return 10;
            case '+=': return 10;
            case '-=': return 10;
            case '*=': return 10;
            case '/=': return 10;
            case '=>': return 100;
            default: return 1;
        }
    }

    private static parseOperator(context: Context, operator: Operator, left: ValueNode, right: ValueNode, token: Token): ValueNode {
        switch(operator) {
            case '=': return parseAssignExpression(context, left, right, token);
            case '+=': return parsePlusAssignExpression(context, left, right, token);
            case '-=': return parseMinusAssignExpression(context, left, right, token);
            case '*=': return parseMultiplyAssignExpression(context, left, right, token);
            case '/=': return parseDivideAssignExpression(context, left, right, token);
            case '+': return parsePlusExpression(context, left, right, token);
            case '-': return parseMinusExpression(context, left, right, token);
            case '*': return parseMultiplyExpression(context, left, right, token);
            case '/': return parseDivideExpression(context, left, right, token);
            case '==': return parseEqualsExpression(context, left, right);
            case '<': return parseLessThanExpression(context, left, right, token);
            case '<=': return parseLessThanEqualsExpression(context, left, right, token);
            case '>': return parseGreaterThanExpression(context, left, right, token);
            case '>=': return parseGreaterThanEqualsExpression(context, left, right, token);
            default: throw new Error(`Unknown operator: ${operator} at ${line(token)}`);
        }
    }
}

function parseOperatorlessExpression(context: Context, cursor: Cursor<Token>): ValueNode {

    let lastValue: ValueNode | undefined;

    while(!cursor.done) {
        const token = cursor.next();

        if(token.type === 'block') {

            if(!token.block) throw new Error(`Unexpected end of block at ${line(token)}`);
            if(!lastValue) {
                if (token.block.length !== 1) throw new Error(`Expected end of block at ${line(token)}`)
                lastValue = context.values.parseValue(context, new Cursor(token.block[0]));
                continue;
            }

            // function call
            if(token.value === '()') {

                const lastValueType = TypeCheck.dereference(lastValue.type)
                if (lastValueType.type !== 'callable') throw new Error(`Cannot call non-callable at ${line(token)}`)

                const args = token.block.map(block => context.values.parseValue(context, new Cursor(block)));
                const params = lastValueType.params;

                if(args.length < params.length) throw new Error(`Too few arguments at ${line(token)}`);
                for(let i = 0; i < params.length; i++) {
                    if(!TypeCheck.matchesValue(context.build.types, params[i], args[i])) {
                        throw new Error(`Expected ${TypeCheck.stringify(params[i])}, got arg ${TypeCheck.stringify(args[i].type)} at ${line(token)}`);
                    }
                }

                lastValue = {
                    type: lastValueType.returnType,
                    value: new CallExpression(lastValue.value, args.map(arg => arg.value))
                }
            }
            // member access
            else if(token.value === '[]') {
                if(token.block.length !== 1) throw new Error(`Expected end of block at ${line(token)}`);

                if(lastValue.type.type !== 'pointer') throw new Error(`Cannot access non-pointer at ${line(token)}`);
                const lastValueType = TypeCheck.dereference(lastValue.type)
                if(!TypeCheck.matchesPrimitive(context.build.types, lastValueType, 'object')) {
                    throw new Error(`Cannot access non-object at ${line(token)}`);
                }

                const property = context.values.parseValue(context, new Cursor(token.block[0]));

                if(!TypeCheck.matchesPrimitive(context.build.types, property.type, 'int')) {
                    throw new Error(`Expected int, got ${TypeCheck.stringify(property.type)} at ${line(token)}`);
                }

                const propertyType = TypeCheck.resolveObject(context.build.types, lastValueType, property);
                if(!propertyType) throw new Error(`Cannot access unknown property at ${line(token)}`);

                lastValue = {
                    type: {
                        type: 'pointer',
                        pointer: propertyType
                    },
                    value: new MemberExpression(lastValue.value, property.value, lastValueType)
                }
            }
        }
        else if(token.type === 'symbol') {
            // member access
            if(token.value === '.') {
                if(!lastValue) throw new Error(`Invalid expression at ${line(token)}`);

                const property = cursor.next();
                if(property.type !== 'identifier') throw new Error(`Expected identifier at ${line(token)}`)

                if(lastValue.type.type !== 'pointer') throw new Error(`Cannot access non-pointer at ${line(token)}`);
                const lastValueType = TypeCheck.dereference(lastValue.type)

                if(lastValueType.type !== 'struct') throw new Error(`Cannot access non-struct at ${line(token)}`);

                const keys = Object.keys(lastValueType.properties);
                const propertyIndex = keys.indexOf(property.value);

                if(propertyIndex === -1) throw new Error(`Cannot access unknown property at ${line(token)}`);
                const propertyType = lastValueType.properties[keys[propertyIndex]];

                lastValue = {
                    type: {
                        type: 'pointer',
                        pointer: propertyType
                    },
                    value: new MemberExpression(lastValue.value, new IntValue(propertyIndex), lastValueType)
                }
            }
            // undefined check
            // TODO: implement this
            // else if(token.value === '?') {
            //     if(!lastValue) throw new Error(`Invalid expression at ${line(token)}`);

            //     lastValue = {
            //         type: {
            //             type: 'primitive',
            //             primitive: 'boolean'
            //         },
            //         value: new EqualsExpression(lastValue.value, )
            //     }
            // }
        }
        else if(token.type === 'keyword') {
            if(token.value === 'as') {
                if(!lastValue) throw new Error(`Invalid expression at ${line(token)}`);

                const type = parseType(context, cursor.remaining());

                // check if both types are primitive
                if(lastValue.type.type === 'primitive' && type.type === 'primitive') {
                    if(lastValue.type.primitive === type.primitive) return lastValue;
                    lastValue = cast(lastValue, lastValue.type, type)
                    continue;
                }

                if(!TypeCheck.matches(context.build.types, lastValue.type, type)) {
                    throw new Error(`Cannot cast ${lastValue.value} to ${TypeCheck.stringify(type)} at ${line(token)}`);
                }

                lastValue = {
                    type: type,
                    value: lastValue.value
                }
            }
        }
        // value
        else {
            if(lastValue) throw new Error(`Unexpected value ${lastValue.value} at ${line(token)}`);
            const value = context.values.parseValue(context, new Cursor([token]));
            lastValue = value;
        }
    }

    if(!lastValue) throw new Error(`Expected value at ${line(cursor.peekLast())}`);
    return lastValue;
}

function parseAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.dereference(left.type);
    if(!TypeCheck.matches(context.build.types, leftType, right.type)) {
        throw new Error(`Cannot assign ${TypeCheck.stringify(right.type)} to ${TypeCheck.stringify(leftType)} at ${line(token)}`);
    }

    if(!(left.value instanceof ReferenceValue)) {
        console.log('not reference value', left.value);
    }
    else {
        const field = FieldResolve.resolve(context.env.fields, left.value.reference);
        if(!field) throw new Error(`Cannot assign to unknown field ${left.value.reference} at ${line(token)}`);
        if(field.isConst) throw new Error(`Cannot assign to const field ${left.value.reference} at ${line(token)}`);
    }

    return {
        type: {
            type: 'primitive',
            primitive: 'void'
        },
        value: new AssignExpression(left.value, right.value)
    }
}

function parsePlusAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parsePlusExpression(context, dereference(context, left, token), right, token), token);
}

function parseMinusAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseMinusExpression(context, dereference(context, left, token), right, token), token);
}

function parseMultiplyAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseMultiplyExpression(context, dereference(context, left, token), right, token), token);
}

function parseDivideAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseDivideExpression(context, dereference(context, left, token), right, token), token);
}

function parsePlusExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'string' || rightType === 'string') {

        const leftValue = stringifyNumber(left);
        const rightValue = stringifyNumber(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'string'
            },
            value: new ConcatStringExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: new AddExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: new AddExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot add ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseMinusExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: new SubtractExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: new SubtractExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot subtract ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseMultiplyExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: new MultiplyExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: new MultiplyExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot multiply ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseDivideExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: new DivideExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: new DivideExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot divide ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseEqualsExpression(context: Context, left: ValueNode, right: ValueNode): ValueNode {
    return {
        type: {
            type: 'primitive',
            primitive: 'boolean'
        },
        value: new EqualsExpression(left.value, right.value)
    }
}

function parseLessThanExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new FloatLessThanExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new IntLessThanExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseGreaterThanExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new FloatGreaterThanExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new IntGreaterThanExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseLessThanEqualsExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new FloatLessThanEqualsExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new IntLessThanEqualsExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

function parseGreaterThanEqualsExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'float' || rightType === 'float') {

        const leftValue = castNumberToFloat(left);
        const rightValue = castNumberToFloat(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new FloatGreaterThanEqualsExpression(leftValue.value, rightValue.value)
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: new IntGreaterThanEqualsExpression(left.value, right.value)
        }
    }
    else {
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}

export function stringifyNumber(value: ValueNode): ValueNode {
    if(value.type.type !== 'primitive') {
        throw new Error(`Cannot stringify ${TypeCheck.stringify(value.type)}`);
    }
    if(value.type.primitive === 'float') value = castToInteger(value, value.type);

    class StringifyInteger extends Value {
        public compile(module: LLVMModule, scope: Scope): llvm.Value {
            const target = value.value.compile(module, scope);
            const sitoaType = llvm.FunctionType.get(llvm.Type.getInt8PtrTy(module._context), [llvm.Type.getInt32Ty(module._context)], false);
            const sitoa = llvm.Function.Create(sitoaType, llvm.Function.LinkageTypes.ExternalLinkage, 'sitoa', module._module);
            return module.builder.CreateCall(sitoa, [target]);
        }
        public toString(): string {
            return `${value.value}`
        }
    }

    return {
        type: {
            type: 'primitive',
            primitive: 'string'
        },
        value: new StringifyInteger()
    }
}

export function castNumberToFloat(value: ValueNode): ValueNode {
    if(value.type.type === 'primitive' && value.type.primitive === 'float') {
        return value;
    }
    else if(value.type.type === 'primitive' && value.type.primitive === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: new IntToFloatCast(value.value)
        }
    }
    else {
        throw new Error(`Cannot cast ${TypeCheck.stringify(value.type)} to float`);
    }
}

export function cast(value: ValueNode, curentType: PrimitiveType, targetType: PrimitiveType): ValueNode {
    switch(targetType.primitive) {
        case 'int':
            return castToInteger(value, curentType);
        case 'float':
            return castToFloat(value, curentType);
        case 'boolean':
            return castToBoolean(value, curentType);
    }
    throw new Error(`Cannot cast ${TypeCheck.stringify(value.type)} to ${targetType}`);
}

function castToInteger(value: ValueNode, curentType: PrimitiveType): ValueNode {
    switch(curentType.primitive) {
        case 'int':
            return value;
        case 'float':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'int'
                },
                value: new FloatToIntCast(value.value)
            }
        case 'boolean':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'int'
                },
                value: new BooleanToIntCast(value.value)
            }
    }
    throw new Error(`Cannot cast ${TypeCheck.stringify(value.type)} to int`);
}

function castToFloat(value: ValueNode, curentType: PrimitiveType): ValueNode {
    switch(curentType.primitive) {
        case 'int':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'float'
                },
                value: new IntToFloatCast(value.value)
            }
        case 'float':
            return value;
        case 'boolean':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'float'
                },
                value: new BooleanToFloatCast(value.value)
            }
    }
    throw new Error(`Cannot cast ${TypeCheck.stringify(value.type)} to float`);
}

function castToBoolean(value: ValueNode, curentType: PrimitiveType): ValueNode {
    switch(curentType.primitive) {
        case 'int':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'boolean'
                },
                value: new IntToBooleanCast(value.value)
            }
        case 'float':
            return {
                type: {
                    type: 'primitive',
                    primitive: 'boolean'
                },
                value: new FloatToBooleanCast(value.value)
            }
        case 'boolean':
            return value;
    }
    throw new Error(`Cannot cast ${TypeCheck.stringify(value.type)} to boolean`);
}