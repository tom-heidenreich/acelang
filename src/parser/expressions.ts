import { BinaryOperator, Operator, UnaryOperator, getPrecendence, isUnaryOperator } from "../constants";
import { IntegerToken, OperatorToken, Token } from "../lexer/tokens";
import { AddOperatorValue, Int64Value, Value } from "./values";

export default function parseExpression(tokens: Token[]): Value {

    if(tokens.length === 0) {
        throw new Error('No tokens provided');
    }

    let dominantOperator: {
        index: number,
        operator: Operator,
        precedence: number,
    } | undefined;

    for(let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if(token instanceof OperatorToken) {
            const operator = token.operator;
            const precedence = getPrecendence(operator);
            if(!dominantOperator || precedence > dominantOperator.precedence) {
                dominantOperator = { index: i, operator, precedence };
            }
        }
    }

    if(!dominantOperator) {
        return parseOperatorlessExpression(tokens);
    }

    const left = tokens.slice(0, dominantOperator.index);
    const right = tokens.slice(dominantOperator.index + 1);

    if(right.length === 0) {
        throw new Error('No right operand found');
    }
    const rightNode = parseExpression(right);

    if(isUnaryOperator(dominantOperator.operator)) return getUnaryOperatorValue(dominantOperator.operator, rightNode);

    if(left.length === 0) {
        throw new Error('No left operand found');
    }
    const leftNode = parseExpression(left);

    return getBinaryOperatorValue(dominantOperator.operator, leftNode, rightNode);
}

function parseOperatorlessExpression(tokens: Token[]): Value {
    if(tokens[0] instanceof IntegerToken) {
        if(tokens.length > 1) {
            throw new SyntaxError(`Unexpected token ${tokens[1]}`)
        }
        return new Int64Value(tokens[0].integer);
    }
    throw new SyntaxError(`Unexpected token ${tokens[0]}`);
}

function getUnaryOperatorValue(operator: UnaryOperator, right: Value): Value {
    throw new Error('Not implemented');
}

function getBinaryOperatorValue(operator: BinaryOperator, left: Value, right: Value): Value {
    switch(operator) {
        case '+': return new AddOperatorValue(left, right);
    }
    throw new Error('Not implemented');
}