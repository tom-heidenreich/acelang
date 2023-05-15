import { DEFAULT_VALUES_ADDON } from "./addons/lexer_addons";
import Lexer from "./lexer";
import { Context, FloatValue, IntValue, Token, Type, ValueNode, Wrappers } from "./types";
import ExpressionParser from "./util/ExpressionParser";
import line from "./util/LineStringify";
import Cursor, { WriteCursor } from "./util/cursor";

export type ValueAddon = {
    name: string,
    operators?: {
        prefix?: {
            operator: string,
            parser: ValueParser<AffixParseFunction, AffixAcceptFunction>
        }[],
        suffix?: {
            operator: string,
            parser: ValueParser<AffixParseFunction, AffixAcceptFunction>
        }[],
        special?: {
            operator: string,
            parser: ValueParser<SpecialParseFunction, SpecialAcceptFunction>
        }[],
        infix?: {
            operator: string,
            parser: ValueParser<InfixParseFunction, InfixAcceptFunction>
        }[],
    },
    expressions?: {
        parser: ValueParser<ExpressionParseFunction, ExpressionAcceptFunction>
    }[],
    values?: {
        tokenType: string,
        parser: ValueParser<ValueParseFunction, ValueAcceptFunction>
    }[],
    register?: {
        operators?: {
            [key: string]: Operator
        }
    }
}

type AffixParseFunction = (token: Token, value: ValueNode) => ValueNode
type AffixAcceptFunction = (token: Token, value: ValueNode) => boolean

type InfixParseFunction = (token: Token, left: ValueNode, right: ValueNode) => ValueNode
type InfixAcceptFunction = (token: Token, left: ValueNode, right: ValueNode) => boolean

type SpecialParseFunction = (leftCursor: Cursor<Token>, rightCursor: Cursor<Token>) => ValueNode
type SpecialAcceptFunction = (leftCursor: Cursor<Token>, rightCursor: Cursor<Token>) => boolean

type ExpressionParseFunction = (token: Token, last?: ValueNode) => ValueNode
type ExpressionAcceptFunction = (token: Token, last?: ValueNode) => boolean

type Operator = {
    predence?: number,
}

type ValueParser<E extends (...args: any[]) => ValueNode, F extends (...args: any[]) => boolean> = {
    id: string,
    priority: number,
    accept: F,
    parse: E,
}

type ValueParseFunction = (context: Context, token: Token, wrappers: Wrappers, predefinedType?: Type) => ValueNode
type ValueAcceptFunction = (token: Token) => boolean

export default class Values {

    private prefixOperators: Map<string, ValueParser<AffixParseFunction, AffixAcceptFunction>[]> = new Map();
    private suffixOperators: Map<string, ValueParser<AffixParseFunction, AffixAcceptFunction>[]> = new Map();
    private specialOperators: Map<string, ValueParser<SpecialParseFunction, SpecialAcceptFunction>[]> = new Map();
    private infixOperators: Map<string, ValueParser<InfixParseFunction, InfixAcceptFunction>[]> = new Map();

    private expressions: ValueParser<ExpressionParseFunction, ExpressionAcceptFunction>[] = [];

    private values: Map<string, ValueParser<ValueParseFunction, ValueAcceptFunction>[]> = new Map();

    private registeredOperators: Map<string, Operator> = new Map();

    constructor(disableDefault: boolean = false) {
        if(!disableDefault) this.addAddon(DEFAULT_VALUES_ADDON)
    }

    public addAddon(addon: ValueAddon) {
        
        if(addon.values) {
            for(const value of addon.values) {
                // modify id
                value.parser.id = `${addon.name}.${value.parser.id || '<anonymous>'}`;

                const parsers = this.values.get(value.tokenType) || [];
                parsers.push(value.parser);
                this.values.set(value.tokenType, parsers);
            }
        }

        if(addon.operators) {
            for(const operator of addon.operators.infix || []) {
                // modify id
                operator.parser.id = `${addon.name}.${operator.parser.id || '<anonymous>'}`;
                const parsers = this.infixOperators.get(operator.operator) || [];
                parsers.push(operator.parser);
                this.infixOperators.set(operator.operator, parsers);
            }
            for(const operator of addon.operators.prefix || []) {
                // modify id
                operator.parser.id = `${addon.name}.${operator.parser.id || '<anonymous>'}`;
                const parsers = this.prefixOperators.get(operator.operator) || [];
                parsers.push(operator.parser);
                this.prefixOperators.set(operator.operator, parsers);
            }
            for(const operator of addon.operators.suffix || []) {
                // modify id
                operator.parser.id = `${addon.name}.${operator.parser.id || '<anonymous>'}`;
                const parsers = this.suffixOperators.get(operator.operator) || [];
                parsers.push(operator.parser);
                this.suffixOperators.set(operator.operator, parsers);
            }
            for(const operator of addon.operators.special || []) {
                // modify id
                operator.parser.id = `${addon.name}.${operator.parser.id || '<anonymous>'}`;
                const parsers = this.specialOperators.get(operator.operator) || [];
                parsers.push(operator.parser);
                this.specialOperators.set(operator.operator, parsers);
            }
        }

        if(addon.expressions) {
            for(const expression of addon.expressions) {
                // modify id
                expression.parser.id = `${addon.name}.${expression.parser.id || '<anonymous>'}`;
                this.expressions.push(expression.parser);
            }
        }

        if(!addon.register) return;

        if(addon.register.operators) {
            for(const key in addon.register.operators) {
                if(this.registeredOperators.has(key)) throw new Error(`Operator ${key} already registered`);
                this.registeredOperators.set(key, addon.register.operators[key]);
            }
        }
    }

    public parseValue(context: Context, cursor: Cursor<Token>, wrappers: Wrappers, predefinedType?: Type): ValueNode {
        // TODO: temporary fix
        if(!cursor.hasOnlyOne()) return ExpressionParser.parse(context, cursor, wrappers);
        // if(!cursor.hasOnlyOne()) return this.parseExpression(context, cursor)
        const token = cursor.next();

        const parsers = this.values.get(token.type);
        if(!parsers) throw new Error(`No parsers for token type ${token.type} at ${line(token)}`);
        parsers.sort((a, b) => b.priority - a.priority);

        const parser = parsers.find(c => c.accept(token));
        if(!parser) throw new Error(`No parser accepted token ${token.type} at ${line(token)}`);

        return parser.parse(context, token, wrappers, predefinedType);
    }

    private parseExpression(context: Context, cursor: Cursor<Token>, wrappers: Wrappers): ValueNode {

        if(cursor.done) throw new Error(`Invalid expression at ${line(cursor.peekLast())}`)
        else if (cursor.hasOnlyOne()) return this.parseValue(context, cursor, wrappers);

        let mainOperatorIndex = -1;
        let mainOperator: string | undefined;
        let mainOperatorPrecedence = -1;

        const leftCursor = new WriteCursor<Token>();
        const rightCursor = new WriteCursor<Token>();

        let index = 0
        while(!cursor.done) {

            const token = cursor.next();

            if(token.type === 'operator') {

                const operator = this.registeredOperators.get(token.value);
                if(!operator) throw new Error(`Unknown operator ${token.value} at ${line(token)}`);
                const precedence = operator.predence || 0;

                if(precedence > mainOperatorPrecedence) {
                    mainOperatorIndex = index;
                    mainOperator = token.value;
                    mainOperatorPrecedence = precedence;
                }
            }
            index++;
        }

        if(mainOperatorIndex === -1) {
            // no operators found, but we have more than one token
            return this.parseOperatorlessExpression(context, cursor.reset());
        }
        // prefix operator
        else if(mainOperatorIndex === 0) {
            const resetCursor = cursor.reset();
            const next = resetCursor.next();
            const value = context.values.parseValue(context, cursor.remaining(), wrappers);
            return this.parsePrefixOperator(context, value, next, mainOperator!);
        }
        // suffix operator
        else if(mainOperatorIndex === index - 1) {
            const last = cursor.rollback();
            const value = context.values.parseValue(context, cursor.reset(), wrappers);
            return this.parseSuffixOperator(context, value, last, mainOperator!);
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
        if(this.specialOperators.has(mainOperator!)) {
            return this.parseSpecialOperator(context, leftCursor.toReadCursor(), rightCursor.toReadCursor(), mainOperator!);
        }

        const left = this.parseExpression(context, leftCursor.toReadCursor(), wrappers);
        const right = this.parseExpression(context, rightCursor.toReadCursor(), wrappers);
        return this.parseOperator(context, mainOperator!, left, right, cursor.peekLast());
    }

    private parsePrefixOperator(context: Context, value: ValueNode, token: Token, operator: string): ValueNode {
        const parsers = this.prefixOperators.get(operator);
        if(!parsers) throw new Error(`No parsers for operator ${operator} at ${line(token)}`);
        parsers.sort((a, b) => b.priority - a.priority);

        const parser = parsers.find(c => c.accept(token, value));
        if(!parser) throw new Error(`No parser accepted operator ${operator} at ${line(token)}`);

        return parser.parse(token, value);
    }

    private parseSuffixOperator(context: Context, value: ValueNode, token: Token, operator: string): ValueNode {
        const parsers = this.suffixOperators.get(operator);
        if(!parsers) throw new Error(`No parsers for operator ${operator} at ${line(token)}`);
        parsers.sort((a, b) => b.priority - a.priority);

        const parser = parsers.find(c => c.accept(token, value));
        if(!parser) throw new Error(`No parser accepted operator ${operator} at ${line(token)}`);

        return parser.parse(token, value);
    }

    private parseSpecialOperator(context: Context, leftCursor: Cursor<Token>, rightCursor: Cursor<Token>, operator: string): ValueNode {
        const parsers = this.specialOperators.get(operator);
        if(!parsers) throw new Error(`No parsers for operator ${operator}`);
        parsers.sort((a, b) => b.priority - a.priority);

        const parser = parsers.find(c => c.accept(leftCursor, rightCursor));
        if(!parser) throw new Error(`No parser accepted operator ${operator}`);

        return parser.parse(leftCursor, rightCursor);
    }

    private parseOperator(context: Context, operator: string, left: ValueNode, right: ValueNode, token: Token): ValueNode {
        const parsers = this.infixOperators.get(operator);
        if(!parsers) throw new Error(`No parsers for operator ${operator} at ${line(token)}`);
        parsers.sort((a, b) => b.priority - a.priority);

        const parser = parsers.find(c => c.accept(token, left, right));
        if(!parser) throw new Error(`No parser accepted operator ${operator} at ${line(token)}`);

        return parser.parse(token, left, right);
    }

    private parseOperatorlessExpression(context: Context, cursor: Cursor<Token>): ValueNode {
        let last: ValueNode | undefined = undefined;
        while(!cursor.done) {
            const next = cursor.next()
            const parser = this.expressions.find(c => c.accept(next, last));
            if(!parser) throw new Error(`No parser accepted token ${next.type} at ${line(next)}`);
            last = parser.parse(next, last);
        }
        if(!last) throw new Error(`Invalid expression at ${line(cursor.peekLast())}`);
        return last;
    }
}