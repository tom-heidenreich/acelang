import jsep from "jsep";
import { LineState, ValueNode } from "../types";
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
        }
        throw new Error(`Unknown expression type: ${expression.type}`);
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