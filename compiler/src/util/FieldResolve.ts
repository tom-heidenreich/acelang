import { Field, FieldInstructions, Fields, Functions, Param } from "../types";

export default class FieldResolve {
    
    private static searchFunctions(functions: Functions, name: string) {
        const func = functions[name];
        if(func) {
            return {
                type: func.returnType
            }
        }
    }

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
}