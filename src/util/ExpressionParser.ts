import { LineState, Operator, PrimitiveType, Token, Type, ValueNode } from "../types";
import Cursor, { WriteCursor } from "./cursor";
import TypeCheck from "./TypeCheck";
import Values from "../parser/values";
import FieldResolve from "./FieldResolve";
import { parseType } from "../parser/types";
import Logger from "./logger";

export default class ExpressionParser {

    public static parse(lineState: LineState, cursor: Cursor<Token>): ValueNode {

        if(cursor.done) throw new Error(`Invalid expression at line ${lineState.lineIndex}`)
        else if (cursor.hasOnlyOne()) return Values.parseValue(lineState, cursor);

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
            return parseOperatorlessExpression(lineState, cursor.reset());
        }
        else if(mainOperatorIndex === 0 && mainOperator === '$') {
            // dereference
            const resetCursor = cursor.reset();
            resetCursor.next();
            const value = Values.parseValue(lineState, cursor.remaining());
            return Values.dereference(lineState, value);
            
        }
        else if(mainOperatorIndex === 0 || mainOperatorIndex === index - 1) {
            throw new Error(`Operator ${mainOperator} at line ${lineState.lineIndex} cannot be used as prefix or suffix`);
        }

        // split the cursor into left and right
        cursor.reset();
        for(let i = 0; i < mainOperatorIndex; i++) leftCursor.push(cursor.next());
        cursor.next();
        while(!cursor.done) rightCursor.push(cursor.next());

        const left = this.parse(lineState, leftCursor.toReadCursor());
        const right = this.parse(lineState, rightCursor.toReadCursor());
        return this.parseOperator(lineState, mainOperator!, left, right);
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
            default: return 1;
        }
    }

    private static parseOperator(lineState: LineState, operator: Operator, left: ValueNode, right: ValueNode): ValueNode {
        switch(operator) {
            case '=': return parseAssignExpression(lineState, left, right);
            case '+=': return parsePlusAssignExpression(lineState, left, right);
            case '-=': return parseMinusAssignExpression(lineState, left, right);
            case '*=': return parseMultiplyAssignExpression(lineState, left, right);
            case '/=': return parseDivideAssignExpression(lineState, left, right);
            case '+': return parsePlusExpression(lineState, left, right);
            case '-': return parseMinusExpression(lineState, left, right);
            case '*': return parseMultiplyExpression(lineState, left, right);
            case '/': return parseDivideExpression(lineState, left, right);
            case '==': return parseEqualsExpression(lineState, left, right);
            case '<': return parseLessThanExpression(lineState, left, right);
            case '<=': return parseLessThanEqualsExpression(lineState, left, right);
            case '>': return parseGreaterThanExpression(lineState, left, right);
            case '>=': return parseGreaterThanEqualsExpression(lineState, left, right);
            default: throw new Error(`Unknown operator: ${operator} at line ${lineState.lineIndex}`);
        }
    }
}

function parseOperatorlessExpression(lineState: LineState, cursor: Cursor<Token>): ValueNode {

    let lastValue: ValueNode | undefined;

    while(!cursor.done) {
        const token = cursor.next();

        if(token.type === 'block') {

            if(!token.block) throw new Error(`Unexpected end of block at line ${lineState.lineIndex}`);
            if(!lastValue) {
                if (token.block.length !== 1) throw new Error(`Expected end of block at line ${lineState.lineIndex}`)
                lastValue = Values.parseValue(lineState, new Cursor(token.block[0]));
                continue;
            }

            // function call
            if(token.value === '()') {

                const lastValueType = TypeCheck.dereference(lastValue.type)
                if (lastValueType.type !== 'callable') throw new Error(`Cannot call non-callable at line ${lineState.lineIndex}`)

                const args = token.block.map(block => Values.parseValue(lineState, new Cursor(block)));
                const params = lastValueType.params;

                if(args.length < params.length) throw new Error(`Too few arguments at line ${lineState.lineIndex}`);
                for(let i = 0; i < params.length; i++) {
                    if(!TypeCheck.matchesValue(lineState.build.types, params[i], args[i])) {
                        throw new Error(`Expected ${TypeCheck.stringify(params[i])}, got arg ${TypeCheck.stringify(args[i].type)} at line ${lineState.lineIndex}`);
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
                if(token.block.length !== 1) throw new Error(`Expected end of block at line ${lineState.lineIndex}`);

                if(!TypeCheck.matchesPrimitive(lineState.build.types, lastValue.type, 'object')) {
                    throw new Error(`Cannot access non-object at line ${lineState.lineIndex}`);
                }

                const property = Values.parseValue(lineState, new Cursor(token.block[0]));
                const propertyType = TypeCheck.resolveObject(lineState.build.types, lastValue.type, property);
                if(!propertyType) throw new Error(`Cannot access unknown property at line ${lineState.lineIndex}`);

                lastValue = {
                    type: propertyType,
                    value: {
                        type: 'member',
                        targetType: lastValue.type,
                        target: lastValue.value,
                        property: property.value
                    }
                }
            }
        }
        else if(token.type === 'symbol') {
            // member access
            if(token.value === '.') {
                if(!lastValue) throw new Error(`Invalid expression at line ${lineState.lineIndex}`);

                const property = cursor.next();
                if(property.type !== 'identifier') throw new Error(`Expected identifier at line ${lineState.lineIndex}`)

                if(!TypeCheck.matchesPrimitive(lineState.build.types, lastValue.type, 'object')) {
                    throw new Error(`Cannot access non-object at line ${lineState.lineIndex}`);
                }

                const propertyNode: ValueNode = {
                    type: {
                        type: 'primitive',
                        primitive: 'string'
                    },
                    value: {
                        type: 'literal',
                        literal: property.value,
                        literalType: 'string'
                    }
                }
                const propertyType = TypeCheck.resolveObject(lineState.build.types, lastValue.type, propertyNode)
                if(!propertyType) throw new Error(`Cannot access unknown property at line ${lineState.lineIndex}`);

                lastValue = {
                    type: propertyType,
                    value: {
                        type: 'member',
                        targetType: lastValue.type,
                        target: lastValue.value,
                        property: propertyNode.value
                    }
                }
            }
            // undefined check
            else if(token.value === '?') {
                if(!lastValue) throw new Error(`Invalid expression at line ${lineState.lineIndex}`);

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
                if(lastValue) throw new Error(`Unexpected value ${Values.stringify(lastValue.value)} at line ${lineState.lineIndex}`);

                const className = cursor.next();
                if(className.type !== 'identifier') throw new Error(`Expected identifier at line ${lineState.lineIndex}`);

                const argsToken = cursor.next();
                if(argsToken.type !== 'block' || argsToken.value !== '()') throw new Error(`Expected end of block at line ${lineState.lineIndex}`);
                else if(!argsToken.block) throw new Error(`Unexpected end of block at line ${lineState.lineIndex}`);

                const args = argsToken.block.map(block => Values.parseValue(lineState, new Cursor(block)));

                // get class
                const classField = FieldResolve.resolve(lineState.env.fields, className.value);
                if(!classField) throw new Error(`Unknown class ${className.value} at line ${lineState.lineIndex}`);
                const resolvedType = classField.type

                if(resolvedType.type !== 'class') throw new Error(`Cannot instantiate non-class ${className.value} at line ${lineState.lineIndex}`);

                // check args
                const params = resolvedType.params;
                if(args.length < params.length) throw new Error(`Too few arguments at line ${lineState.lineIndex}`);
                for(let i = 0; i < params.length; i++) {
                    if(!TypeCheck.matchesValue(lineState.build.types, params[i], args[i])) {
                        throw new Error(`Expected ${TypeCheck.stringify(params[i])}, got arg ${TypeCheck.stringify(args[i].type)} at line ${lineState.lineIndex}`);
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
                if(!lastValue) throw new Error(`Invalid expression at line ${lineState.lineIndex}`);

                const type = parseType(lineState, cursor.remaining());

                if(!TypeCheck.matches(lineState.build.types, lastValue.type, type)) {
                    throw new Error(`Cannot cast ${Values.stringify(lastValue.value)} to ${TypeCheck.stringify(type)} at line ${lineState.lineIndex}`);
                }

                lastValue = {
                    type: type,
                    value: lastValue.value
                }
            }
        }
        // value
        else {
            if(lastValue) throw new Error(`Unexpected value ${Values.stringify(lastValue.value)} at line ${lineState.lineIndex}`);
            const value = Values.parseValue(lineState, new Cursor([token]));
            lastValue = value;
        }
    }

    if(!lastValue) throw new Error(`Expected value at line ${lineState.lineIndex}`);
    return lastValue;
}

function parseAssignExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.dereference(left.type);
    if(!TypeCheck.matches(lineState.build.types, leftType, right.type)) {
        throw new Error(`Cannot assign ${TypeCheck.stringify(right.type)} to ${TypeCheck.stringify(leftType)} at line ${lineState.lineIndex}`);
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

function parsePlusAssignExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {
    return parseAssignExpression(lineState, left, parsePlusExpression(lineState, Values.dereference(lineState, left), right));
}

function parseMinusAssignExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {
    return parseAssignExpression(lineState, left, parseMinusExpression(lineState, Values.dereference(lineState, left), right));
}

function parseMultiplyAssignExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {
    return parseAssignExpression(lineState, left, parseMultiplyExpression(lineState, Values.dereference(lineState, left), right));
}

function parseDivideAssignExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {
    return parseAssignExpression(lineState, left, parseDivideExpression(lineState, Values.dereference(lineState, left), right));
}

function parsePlusExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot add ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseMinusExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot subtract ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseMultiplyExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot multiply ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseDivideExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot divide ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseEqualsExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {
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

function parseLessThanExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseGreaterThanExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseLessThanEqualsExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
    }
}

function parseGreaterThanEqualsExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

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
        throw new Error(`Cannot compare ${TypeCheck.stringify(left.type)} and ${TypeCheck.stringify(right.type)} at line ${lineState.lineIndex}`);
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