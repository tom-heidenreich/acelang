import { DataType, Primitive, PrimitiveValue, Type, Types, Value, ValueResult } from "../types";

export default class TypeCheck {

    public static matchesPrimitive(types: Types, match: Type, against: DataType): boolean {
        if(match.type === 'primitive') {
            return match.primitive === against;
        }
        else if(match.type === 'reference') {
            return TypeCheck.matchesPrimitive(types, types[match.reference], against);
        }
        else if(match.type === 'union') {
            return match.oneOf.some(type => TypeCheck.matchesPrimitive(types, type, against));
        }
        return false;
    }

    public static matchesValue(types: Types, match: Type, against: ValueResult): boolean {
        const againstValue = against.value.type === 'primitive' ? against.value.primitive : undefined;
        return TypeCheck.matches(types, match, against.type, againstValue);
    }

    public static matches(types: Types, match: Type, against: Type, againstValue?: Primitive): boolean {

        console.log(match, against);

        // match
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

    public static stringify(type: Type) {
        // TODO: Implement
        // console.log(type);
    }
}