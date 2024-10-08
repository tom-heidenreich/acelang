import { ArrayType, DataType, Literal, Type, Types, ValueNode } from "../types";

export default class TypeCheck {

    public static matchesPrimitive(types: Types, match: Type, ...against: DataType[]): boolean {
        if(against.length === 0) return false;
        else if(against.length > 1) return against.some(type => TypeCheck.matchesPrimitive(types, match, type));
        else {
            if(against[0] === 'unknown' || against[0] === 'any') return true;
            else if(match.type === 'primitive') {
                if(match.primitive === 'any' || match.primitive === 'unknown') return true;
                return match.primitive === against[0];
            }
            else if(match.type === 'union') {
                return match.oneOf.some(type => TypeCheck.matchesPrimitive(types, type, against[0]));
            }
            else if(match.type === 'struct' || match.type === 'array' || match.type === 'object' || match.type === 'class') {
                return against[0] === 'object';
            }
            else if(match.type === 'literal' && match.literal === 'undefined') {
                return against[0] === 'undefined';
            }
            return false;
        }
    }

    public static matchesValue(types: Types, match: Type, against: ValueNode): boolean {
        const againstValue = against.value.type === 'literal' ? against.value.literal : undefined;
        return TypeCheck.matches(types, match, against.type, againstValue);
    }

    public static matches(types: Types, match: Type, against: Type, againstValue?: Literal): boolean {

        // match
        if(match.type === 'primitive') {
            if(match.primitive === 'any' || match.primitive === 'unknown') return true;
        }
        if(match.type === 'union') {
            return match.oneOf.some(type => TypeCheck.matches(types, type, against, againstValue));
        }
        else if(match.type === 'literal') {
            if(against.type === 'literal') {
                return match.literal === against.literal;
            }
            else if(against.type !== 'primitive') return false;
            return match.literal === againstValue;
        }
        else if(match.type === 'pointer') {
            if(against.type === 'pointer') {
                return TypeCheck.matches(types, match.pointer, against.pointer, againstValue);
            }
            return false;
        }
        else if(match.type === 'callable') {
            if(against.type !== 'callable') return false;
            if(match.params.length !== against.params.length) return false;
            for(let i = 0; i < match.params.length; i++) {
                if(!TypeCheck.matches(types, match.params[i], against.params[i])) return false;
            }
            return TypeCheck.matches(types, match.returnType, against.returnType);
        }
        // against
        else if(against.type === 'primitive') {
            return TypeCheck.matchesPrimitive(types, match, against.primitive);
        }
        else if(against.type === 'union') {
            return against.oneOf.some(type => TypeCheck.matches(types, match, type, againstValue));
        }
        else if(against.type === 'struct') {
            if(match.type !== 'struct') return false;

            const matchkeys = Object.keys(match.properties);
            const againstkeys = Object.keys(against.properties);

            if(matchkeys.length > againstkeys.length) return false;
            for(const key of matchkeys) {
                if(!against.properties[key]) return false;
                if(!TypeCheck.matches(types, match.properties[key], against.properties[key], againstValue)) return false;
            }
            return true;
        }
        else if(against.type === 'array') {
            if(match.type !== 'array') return false;
            return TypeCheck.arrayMatches(types, match, against);
        }
        return false;
    }

    public static arrayMatches(types: Types, match: ArrayType, against: ArrayType) {
        if(match.size !== against.size) return false;
        return TypeCheck.matches(types, match.items, against.items);
    }

    public static resolveObject(types: Types, type: Type, key: ValueNode): Type | undefined {
        if(type.type === 'primitive' && type.primitive === 'any') return type;
        else if(type.type === 'struct') {
            if(key.value.type !== 'literal') return undefined;
            if(key.value.literalType === 'string') return type.properties[key.value.literal.toString()];
            else if(key.value.literalType === 'int') {
                const keys = Object.keys(type.properties);
                return type.properties[keys[key.value.literal as number]];
            }
            return undefined;
        }
        else if(type.type === 'object') {
            return type.values;
        }
        else if(type.type === 'array') {
            return type.items;
        }
        else if(type.type === 'class') {
            if(key.value.type !== 'literal') return undefined;
            return type.statics[key.value.literal.toString()];
        }
        else if(type.type === 'union') {
            const resolvedTypes: Type[] = [] 
            for(const oneOfType of type.oneOf) {
                const resolved = TypeCheck.resolveObject(types, oneOfType, key);
                if(resolved && resolvedTypes.indexOf(resolved) === -1) resolvedTypes.push(resolved);
            }
            if(resolvedTypes.length === 0) return undefined;
            else if(resolvedTypes.length === 1) return resolvedTypes[0];
            else return { type: 'union', oneOf: resolvedTypes };
        }
        return undefined;
    }

    public static resolvePrimitive(types: Types, type: Type): DataType {
        if(type.type === 'primitive') return type.primitive;
        else if(type.type === 'union') {
            const resolvedTypes: DataType[] = [] 
            for(const oneOfType of type.oneOf) {
                const resolved = TypeCheck.resolvePrimitive(types, oneOfType);
                if(resolvedTypes.indexOf(resolved) === -1) resolvedTypes.push(resolved);
            }
            if(resolvedTypes.length === 0) return 'unknown';
            else if(resolvedTypes.length === 1) return resolvedTypes[0];
            else return 'any';
        }
        else if(type.type === 'struct' || type.type === 'array') return 'object';
        else if(type.type === 'callable') return 'callable';
        return 'unknown';
    }

    public static stringify(type: Type): Literal {
        if(type.type === 'primitive') {
            return type.primitive;
        }
        else if(type.type === 'union') {
            return type.oneOf.map(TypeCheck.stringify).join(' | ');
        }
        else if(type.type === 'struct') {
            return '{ ' + Object.keys(type.properties).map(key => `${key}: ${TypeCheck.stringify(type.properties[key])}`).join(', ') + ' }';
        }
        else if(type.type === 'array') {
            return `${TypeCheck.stringify(type.items)}[${type.size}]`;
        }
        else if(type.type === 'literal') {
            return type.literal;
        }
        else if(type.type === 'pointer') {
            return `${TypeCheck.stringify(type.pointer)}*`;
        }
        else if(type.type === 'callable') {
            return `((${type.params.map(TypeCheck.stringify).join(', ')}) => ${TypeCheck.stringify(type.returnType)})`
        }
        return 'unknown';
    }

    public static toPrimitive(types: Types, type: Type): DataType {
        if(type.type === 'primitive') {
            return type.primitive;
        }
        else if(type.type === 'union') {
            const resolvedTypes: DataType[] = [] 
            for(const oneOfType of type.oneOf) {
                const resolved = TypeCheck.toPrimitive(types, oneOfType);
                if(resolvedTypes.indexOf(resolved) === -1) resolvedTypes.push(resolved);
            }
            if(resolvedTypes.length === 0) return 'unknown';
            else if(resolvedTypes.length === 1) return resolvedTypes[0];
            else return 'any';
        }
        else if(type.type === 'struct' || type.type === 'array' || type.type === 'object' || type.type === 'class') {
            return 'object';
        }
        return 'unknown';
    }

    public static isNumber(type: Type): boolean {
        return type.type === 'primitive' && (type.primitive === 'float' || type.primitive === 'int');
    }

    public static dereference(type: Type): Type {
        if(type.type !== 'pointer') return type;
        return type.pointer;
    }
}