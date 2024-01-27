import { BinaryOperator, Operator, UnaryOperator, getPrecendence, isUnaryOperator } from "../constants";
import { IdentifierToken, IntegerToken, OperatorToken, Token } from "../lexer/tokens";
import { IntType } from "../types";
import { Int32Value, IntAddOperatorValue, ReferenceValue, TypedValue } from "../values";
import { Parser } from "./util";

export default class ExpressionParser extends Parser {

    private parseExpression(tokens: Token[]): TypedValue {

        if(tokens.length === 0) throw new Error('No tokens provided');
    
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
            return this.parseOperatorlessExpression(tokens);
        }
    
        const left = tokens.slice(0, dominantOperator.index);
        const right = tokens.slice(dominantOperator.index + 1);
    
        if(right.length === 0) {
            throw new Error('No right operand found');
        }
        const rightNode = this.parseExpression(right);
    
        if(isUnaryOperator(dominantOperator.operator)) return this.getUnaryOperatorValue(dominantOperator.operator, rightNode);
    
        if(left.length === 0) {
            throw new Error('No left operand found');
        }
        const leftNode = this.parseExpression(left);
    
        return this.getBinaryOperatorValue(dominantOperator.operator, leftNode, rightNode);
    }

    private parseOperatorlessExpression(tokens: Token[]): TypedValue {
        if(tokens[0] instanceof IntegerToken) {
            if(tokens.length > 1) {
                throw new SyntaxError(`Unexpected token ${tokens[1]}`)
            }
            return new Int32Value(tokens[0].integer);
        }
        if(tokens[0] instanceof IdentifierToken) {
            if(tokens.length > 1) {
                throw new Error('Not implemented');
            }
            const field = this.env.get(tokens[0].identifier);
            if(!field) throw new Error(`Unknown field ${tokens[0].identifier}`);
            // TODO: ownership or borrow check
            return new ReferenceValue(field);
        }
        throw new SyntaxError(`Unexpected token ${tokens[0]}`);
    }

    private getUnaryOperatorValue(operator: UnaryOperator, right: TypedValue): TypedValue {
        throw new Error('Not implemented');
    }

    private getBinaryOperatorValue(operator: BinaryOperator, left: TypedValue, right: TypedValue): TypedValue {
        switch(operator) {
            case '+': {
                if(left.type instanceof IntType) {
                    if(!left.type.matches(right.type)) throw new Error(`Cannot add ${left.type} and ${right.type}`);
                    return new IntAddOperatorValue(left, right);
                }
            }
        }
        throw new Error('Not implemented');
    }

    public parse(): TypedValue {
        return this.parseExpression(this.remaining);
    }
}