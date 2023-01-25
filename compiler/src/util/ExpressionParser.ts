import { LineState, Operator, Token, ValueNode } from "../types";
import Cursor, { WriteCursor } from "./cursor";
import TypeCheck from "./TypeCheck";
import Values from "../parser/values";
import FieldResolve from "./FieldResolve";

export default class ExpressionParser {

    public static parse(lineState: LineState, cursor: Cursor<Token>): ValueNode {

        if(cursor.done) throw new Error(`Invalid expression at line ${lineState.lineIndex}`)
        else if(cursor.hasOnlyOne()) return Values.parseValue(lineState, cursor);

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
        else if(mainOperatorIndex === 0 || mainOperatorIndex === index - 1) throw new Error(`Invalid expression at line ${lineState.lineIndex}`);

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
            case '+':
                return 1;
            case '*':
                return 2;
            default:
                return 0;
        }
    }

    private static parseOperator(lineState: LineState, operator: Operator, left: ValueNode, right: ValueNode): ValueNode {
        switch(operator) {
            case '+': return parsePlusExpression(lineState, left, right);
            case '*': return parseMultiplyExpression(lineState, left, right);
            case '==': return parseEqualsExpression(lineState, left, right);
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
            if(!lastValue) throw new Error(`Invalid expression at line ${lineState.lineIndex}`)

            // function call
            if(token.value === '()') {

                if(lastValue.type.type !== 'callable') throw new Error(`Cannot call non-callable at line ${lineState.lineIndex}`)

                const args = token.block.map(block => Values.parseValue(lineState, new Cursor(block)));
                if(!TypeCheck.matchesArgs(lineState.build.types, lastValue.type.params, args)) throw new Error(`Invalid arguments at line ${lineState.lineIndex}`)

                lastValue = {
                    type: lastValue.type.returnType,
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
        else if(token.type === 'keyword' && token.value === 'new') {
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
            const resolvedType = TypeCheck.resolveReferences(lineState.build.types, classField.type);

            if(resolvedType.type !== 'class') throw new Error(`Cannot instantiate non-class ${className.value} at line ${lineState.lineIndex}`);

            // check args
            if(!TypeCheck.matchesArgs(lineState.build.types, resolvedType.params, args)) throw new Error(`Invalid arguments at line ${lineState.lineIndex}`);

            lastValue = {
                type: resolvedType.publicType,
                value: {
                    type: 'instantiation',
                    className: className.value,
                    args: args.map(arg => arg.value)
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

function parsePlusExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

    if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'intAdd',
                left: left.value,
                right: right.value
            }
        }
    }
    else if((leftType === 'float' || leftType === 'int') && (rightType === 'float' || rightType === 'int')) {
        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: {
                type: 'floatAdd',
                left: left.value,
                right: right.value
            }
        }
    }
    else if(leftType === 'string' || rightType === 'string') {
        return {
            type: {
                type: 'primitive',
                primitive: 'string'
            },
            value: {
                type: 'stringConcat',
                left: left.value,
                right: right.value
            }
        }
    }
    else {
        throw new Error(`Cannot add ${leftType} and ${rightType} at line ${lineState.lineIndex}`);
    }
}

function parseMultiplyExpression(lineState: LineState, left: ValueNode, right: ValueNode): ValueNode {

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, left.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, right.type);

    if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'intMultiply',
                left: left.value,
                right: right.value
            }
        }
    }
    else if((leftType === 'float' || leftType === 'int') && (rightType === 'float' || rightType === 'int')) {
        return {
            type: {
                type: 'primitive',
                primitive: 'float'
            },
            value: {
                type: 'floatMultiply',
                left: left.value,
                right: right.value
            }
        }
    }
    else {
        throw new Error(`Cannot multiply ${leftType} and ${rightType} at line ${lineState.lineIndex}`);
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