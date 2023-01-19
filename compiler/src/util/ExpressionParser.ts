import jsep from "jsep";
import { LineState, ValueNode } from "../types";
import FieldResolve from "./FieldResolve";
import TypeCheck from "./TypeCheck";

export default class ExpressionParser {

    public static parse(lineState: LineState, expression: jsep.Expression): ValueNode {

        const left = expression.left as jsep.Expression;
        const right = expression.right as jsep.Expression;
    
        switch(expression.type) {
            case "BinaryExpression":
                switch(expression.operator) {
                    case "+": return parsePlusExpression(lineState, left, right);
                }
                break;
            case 'CallExpression': return parseCallExpression(lineState, expression.callee as jsep.Expression, expression.arguments as jsep.Expression[]);
            case 'MemberExpression': return parseMemberExpression(lineState, expression.object as jsep.Expression, expression.property as jsep.Expression);
            case 'Identifier': {
                const field = FieldResolve.resolve(lineState.env.fields, expression.name as string);
                if(!field) {
                    throw new Error(`Unknown field: ${expression.name} at line ${lineState.lineIndex}`);
                }
                return {
                    type: field.type,
                    value: {
                        type: 'reference',
                        reference: expression.name as string,
                        referenceType: field.type
                    }
                }
            }
        }
        throw new Error(`Unknown expression type: ${expression.type}`);
    }
}

function parseMemberExpression(lineState: LineState, target: jsep.Expression, property: jsep.Expression): ValueNode {

    const targetNode = ExpressionParser.parse(lineState, target);
    if(targetNode.value.type !== 'reference') {
        throw new Error(`Cannot access non-reference at line ${lineState.lineIndex}`);
    }
    const targetName = targetNode.value.reference
    const targetField = FieldResolve.resolve(lineState.env.fields, targetName);
    if(!targetField) {
        throw new Error(`Unknown field: ${targetName} at line ${lineState.lineIndex}`);
    }
    if(!TypeCheck.matchesPrimitive(lineState.build.types, targetField.type, 'object')) {
        throw new Error(`Cannot access non-object at line ${lineState.lineIndex}`);
    }
    
    const propertyNode = ExpressionParser.parse(lineState, property);
    const propertyType = TypeCheck.resolveObject(lineState.build.types, targetField.type, propertyNode);
    if(!propertyType) {
        throw new Error(`Cannot access unknown property at line ${lineState.lineIndex}`);
    }

    return {
        type: propertyType,
        value: {
            type: 'member',
            target: targetNode.value,
            property: propertyNode.value
        }
    }
}

function parseCallExpression(lineState: LineState, callee: jsep.Expression, args: jsep.Expression[]): ValueNode {

    const calleeNode = ExpressionParser.parse(lineState, callee);
    if(calleeNode.value.type !== 'reference') {
        throw new Error(`Cannot call non-reference at line ${lineState.lineIndex}`);
    }
    const callableName = calleeNode.value.reference
    const calleeField = FieldResolve.resolve(lineState.env.fields, callableName);
    if(!calleeField) {
        throw new Error(`Unknown field: ${callableName} at line ${lineState.lineIndex}`);
    }
    if(!TypeCheck.matchesPrimitive(lineState.build.types, calleeField.type, 'callable')) {
        throw new Error(`Cannot call non-callable at line ${lineState.lineIndex}`);
    }
    const callable = lineState.build.callables[callableName];

    const argsNodes = args.map(arg => ExpressionParser.parse(lineState, arg));

    if(!TypeCheck.matchesArgs(lineState.build.types, callable.params, argsNodes)) {
        throw new Error(`Argument types do not match callable ${callableName} at line ${lineState.lineIndex}`);
    }

    return {
        type: callable.returnType,
        value: {
            type: 'call',
            callable: calleeNode.value,
            args: argsNodes.map(arg => arg.value)
        }
    }
}

function parsePlusExpression(lineState: LineState, left: jsep.Expression, right: jsep.Expression): ValueNode {
    
    const leftNode = ExpressionParser.parse(lineState, left);
    const rightNode = ExpressionParser.parse(lineState, right);

    const leftType = TypeCheck.resolvePrimitive(lineState.build.types, leftNode.type);
    const rightType = TypeCheck.resolvePrimitive(lineState.build.types, rightNode.type);

    if(leftType === 'int' && rightType === 'int') {
        return {
            type: {
                type: 'primitive',
                primitive: 'int'
            },
            value: {
                type: 'intAdd',
                left: leftNode.value,
                right: rightNode.value
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
                left: leftNode.value,
                right: rightNode.value
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
                left: leftNode.value,
                right: rightNode.value
            }
        }
    }
    else {
        throw new Error(`Cannot add ${leftType} and ${rightType} at line ${lineState.lineIndex}`);
    }
}