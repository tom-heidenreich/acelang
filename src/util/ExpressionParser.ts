import { Context, Operator, PrimitiveType, Token, Type, ValueNode } from "../types";
import Cursor, { WriteCursor } from "./cursor";
import TypeCheck from "./TypeCheck";
import Values from "../parser/values";
import FieldResolve from "./FieldResolve";
import { parseType } from "../parser/types";
import Logger from "./logger";
import line from "./LineStringify";
import { parseArrowFunction } from "../parser/functions";

export default class ExpressionParser {

    public static parse(context: Context, cursor: Cursor<Token>): ValueNode {

        if(cursor.done) throw new Error(`Invalid expression at ${line(cursor.peekLast())}`)
        else if (cursor.hasOnlyOne()) return Values.parseValue(context, cursor);

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
                const value = Values.parseValue(context, cursor.remaining());
                return Values.dereference(context, value, next);
            }
            else if(mainOperator === '*') {
                // pointer
                const resetCursor = cursor.reset();
                const next = resetCursor.next();
                const value = Values.parseValue(context, cursor.remaining());
                return Values.pointerCast(context, value, next);
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
            case '*': return 3;
            case '/': return 3;
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
                lastValue = Values.parseValue(context, new Cursor(token.block[0]));
                continue;
            }

            // function call
            if(token.value === '()') {

                const lastValueType = TypeCheck.dereference(lastValue.type)
                if (lastValueType.type !== 'callable') throw new Error(`Cannot call non-callable at ${line(token)}`)

                const args = token.block.map(block => Values.parseValue(context, new Cursor(block)));
                const params = lastValueType.params;

                if(args.length < params.length) throw new Error(`Too few arguments at ${line(token)}`);
                for(let i = 0; i < params.length; i++) {
                    if(!TypeCheck.matchesValue(context.build.types, params[i], args[i])) {
                        throw new Error(`Expected ${TypeCheck.stringify(params[i])}, got arg ${TypeCheck.stringify(args[i].type)} at ${line(token)}`);
                    }
                }

                lastValue = {
                    type: lastValueType.returnType,
                    value: {
                        type: 'call',
                        callable: lastValue.value,
                        args: args.map(arg => arg.value)
                    }
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

                const property = Values.parseValue(context, new Cursor(token.block[0]));

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
                    value: {
                        type: 'member',
                        targetType: lastValueType,
                        target: lastValue.value,
                        property: property.value
                    }
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
                    value: {
                        type: 'member',
                        targetType: lastValueType,
                        target: lastValue.value,
                        property: {
                            type: 'literal',
                            literal: propertyIndex,
                            literalType: 'int'
                        }
                    }
                }
            }
            // undefined check
            else if(token.value === '?') {
                if(!lastValue) throw new Error(`Invalid expression at ${line(token)}`);

                lastValue = {
                    type: {
                        type: 'primitive',
                        primitive: 'boolean'
                    },
                    value: {
                        type: 'equals',
                        left: lastValue.value,
                        right: {
                            type: 'undefined',
                        }
                    }
                }
            }
        }
        else if(token.type === 'keyword') {
            if(token.value === 'new') {
                if(lastValue) throw new Error(`Unexpected value ${Values.stringify(lastValue.value)} at ${line(token)}`);

                const className = cursor.next();
                if(className.type !== 'identifier') throw new Error(`Expected identifier at line ${line(token)}`);

                const argsToken = cursor.next();
                if(argsToken.type !== 'block' || argsToken.value !== '()') throw new Error(`Expected end of block at ${line(token)}`);
                else if(!argsToken.block) throw new Error(`Unexpected end of block at ${line(token)}`);

                const args = argsToken.block.map(block => Values.parseValue(context, new Cursor(block)));

                // get class
                const classField = FieldResolve.resolve(context.env.fields, className.value);
                if(!classField) throw new Error(`Unknown class ${className.value} at ${line(token)}`);
                const resolvedType = classField.type

                if(resolvedType.type !== 'class') throw new Error(`Cannot instantiate non-class ${className.value} at ${line(token)}`);

                // check args
                const params = resolvedType.params;
                if(args.length < params.length) throw new Error(`Too few arguments at ${line(token)}`);
                for(let i = 0; i < params.length; i++) {
                    if(!TypeCheck.matchesValue(context.build.types, params[i], args[i])) {
                        throw new Error(`Expected ${TypeCheck.stringify(params[i])}, got arg ${TypeCheck.stringify(args[i].type)} at ${line(token)}`);
                    }
                }

                lastValue = {
                    type: resolvedType.publicType,
                    value: {
                        type: 'instantiation',
                        className: className.value,
                        args: args.map(arg => arg.value)
                    }
                }
            }
            else if(token.value === 'as') {
                if(!lastValue) throw new Error(`Invalid expression at ${line(token)}`);

                const type = parseType(context, cursor.remaining());

                // check if both types are primitive
                if(lastValue.type.type === 'primitive' && type.type === 'primitive') {
                    if(lastValue.type.primitive === type.primitive) return lastValue;
                    lastValue = {
                        type: type,
                        value: {
                            type: 'cast',
                            value: lastValue.value,
                            targetType: type.primitive,
                            currentType: lastValue.type.primitive
                        }
                    }
                    continue;
                }

                if(!TypeCheck.matches(context.build.types, lastValue.type, type)) {
                    throw new Error(`Cannot cast ${Values.stringify(lastValue.value)} to ${TypeCheck.stringify(type)} at ${line(token)}`);
                }

                lastValue = {
                    type: type,
                    value: lastValue.value
                }
            }
        }
        // value
        else {
            if(lastValue) throw new Error(`Unexpected value ${Values.stringify(lastValue.value)} at ${line(token)}`);
            const value = Values.parseValue(context, new Cursor([token]));
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

    return {
        type: {
            type: 'primitive',
            primitive: 'void'
        },
        value: {
            type: 'assign',
            target: left.value,
            value: right.value
        }
    }
}

function parsePlusAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parsePlusExpression(context, Values.dereference(context, left, token), right, token), token);
}

function parseMinusAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseMinusExpression(context, Values.dereference(context, left, token), right, token), token);
}

function parseMultiplyAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseMultiplyExpression(context, Values.dereference(context, left, token), right, token), token);
}

function parseDivideAssignExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {
    return parseAssignExpression(context, left, parseDivideExpression(context, Values.dereference(context, left, token), right, token), token);
}

function parsePlusExpression(context: Context, left: ValueNode, right: ValueNode, token: Token): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(context.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(context.build.types, right.type);

    // sorted by priority

    if(leftType === 'string' || rightType === 'string') {

        const leftValue = castNumberToString(left);
        const rightValue = castNumberToString(right);

        return {
            type: {
                type: 'primitive',
                primitive: 'string'
            },
            value: {
                type: 'stringConcat',
                left: leftValue.value,
                right: rightValue.value
            }
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
            value: {
                type: 'add',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'add',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'subtract',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'subtract',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'multiply',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'multiply',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'divide',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'divide',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
        value: {
            type: 'equals',
            left: left.value,
            right: right.value
        }
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
            value: {
                type: 'lessThan',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: {
                type: 'lessThan',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'greaterThan',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: {
                type: 'greaterThan',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'lessThanEquals',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: {
                type: 'lessThanEquals',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
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
            value: {
                type: 'greaterThanEquals',
                left: leftValue.value,
                right: rightValue.value,
                numberType: 'float'
            }
        }
    }
    else if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'boolean'
            },
            value: {
                type: 'greaterThanEquals',
                left: left.value,
                right: right.value,
                numberType: 'int'
            }
        }
    }
    else {
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at ${line(token)}`);
    }
}


export function castNumberToInt(value: ValueNode): ValueNode {
    if(value.type.type === 'primitive' && value.type.primitive === 'int') return value;
    if(!TypeCheck.isNumber(value.type)) {
        throw new Error(`Expected number, got ${TypeCheck.stringify(value.type)}`);
    }
    return castToPrimitive(value, {
        type: 'primitive',
        primitive: 'int'
    });
}

export function castNumberToFloat(value: ValueNode): ValueNode {
    if(value.type.type === 'primitive' && value.type.primitive === 'float') return value;
    if(!TypeCheck.isNumber(value.type)) {
        throw new Error(`Expected number, got ${TypeCheck.stringify(value.type)}`);
    }
    return castToPrimitive(value, {
        type: 'primitive',
        primitive: 'float'
    });
}

export function castNumberToString(value: ValueNode): ValueNode {
    if(value.type.type === 'primitive' && value.type.primitive === 'string') return value;
    if(!TypeCheck.isNumber(value.type)) {
        throw new Error(`Expected number, got ${TypeCheck.stringify(value.type)}`);
    }
    return castToPrimitive(value, {
        type: 'primitive',
        primitive: 'string'
    });
}

export function castToPrimitive(value: ValueNode, type: PrimitiveType): ValueNode {
    if(value.type.type !== 'primitive') throw new Error(`Expected primitive, got ${value.type.type}`);
    return {
        type: type,
        value: {
            type: 'cast',
            value: value.value,
            targetType: type.primitive,
            currentType: value.type.primitive
        }
    }
}