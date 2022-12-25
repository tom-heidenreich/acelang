import { Field, FieldInstructions, Fields, Functions, Param } from "../types";

export default class FieldResolve {

    public static resolve(fields: FieldInstructions, name: string, functions?: Functions): Field | undefined {

        let field: Field;

        // search local
        field = fields.local[name];
        if(field) return field;

        // search parent
        if(fields.parent) {
            return FieldResolve.resolve({
                parent: fields.parent.parent,
                local: fields.parent.local,
            }, name);
        }

        return undefined;
    }

    public static resolveReferences(field: Field, fields: FieldInstructions): string | undefined {
        if(field.reference) {
            const ref = FieldResolve.resolve(fields, field.reference);
            if(ref) {
                const resolvedRef = FieldResolve.resolveReferences(ref, fields);
                if(resolvedRef) return resolvedRef;
            }
            else {
                throw new Error(`Reference ${field.reference} not found`);
            }
            return field.reference;
        }
        return;
    }
}