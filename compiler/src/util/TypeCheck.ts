import { DataType, Key, Param, Literal, Type, Types, ValueNode } from "../types";

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
            else if(match.type === 'reference') {
                return TypeCheck.matchesPrimitive(types, types[match.reference], against[0]);
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
        else if(match.type === 'reference') {
            return TypeCheck.matches(types, types[match.reference], against, againstValue);
        }
        else if(match.type === 'literal') {
            if(against.type === 'literal') {
                return match.literal === against.literal;
            }
            else if(against.type !== 'primitive') return false;
            return match.literal === againstValue;
        }
        // against
        else if(against.type === 'primitive') {
            return TypeCheck.matchesPrimitive(types, match, against.primitive);
        }
        else if(against.type === 'reference') {
            return TypeCheck.matches(types, match, types[against.reference], againstValue);
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
            return TypeCheck.matches(types, match.items, against.items, againstValue);
        }
        return false;
    }

    public static resolveReferences(types: Types, type: Type): Type {
        if(type.type === 'reference') return TypeCheck.resolveReferences(types, types[type.reference]);
        else return type;
    }

    public static matchesArgs(types: Types, params: Type[], args: ValueNode[]) {
        if(args.length < params.length) return false;
        for(let i = 0; i < params.length; i++) {
            if(!TypeCheck.matchesValue(types, params[i], args[i])) return false;
        }
        return true;
    }

    public static resolveObject(types: Types, type: Type, key: ValueNode): Type | undefined {
        if(type.type === 'primitive' && type.primitive === 'any') return type;
        else if(type.type === 'reference') {
            return TypeCheck.resolveObject(types, types[type.reference], key);
        }
        else if(type.type === 'struct') {
            if(key.value.type !== 'literal') return undefined;
            return type.properties[key.value.literal.toString()];
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
        else if(type.type === 'reference') return TypeCheck.resolvePrimitive(types, types[type.reference]);
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
        else if(type.type === 'reference') {
            return type.reference;
        }
        else if(type.type === 'union') {
            return type.oneOf.map(TypeCheck.stringify).join(' | ');
        }
        else if(type.type === 'struct') {
            return '{ ' + Object.keys(type.properties).map(key => `${key}: ${TypeCheck.stringify(type.properties[key])}`).join(', ') + ' }';
        }
        else if(type.type === 'array') {
            return `${TypeCheck.stringify(type.items)}[]`;
        }
        else if(type.type === 'literal') {
            return type.literal;
        }
        return 'unknown';
    }

    public static toPrimitive(types: Types, type: Type): DataType {
        if(type.type === 'primitive') {
            return type.primitive;
        }
        else if(type.type === 'reference') {
            return TypeCheck.toPrimitive(types, types[type.reference]);
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
        else if(type.type === 'struct' || type.type === 'array') {
            return 'object';
        }
        return 'unknown';
    }
}