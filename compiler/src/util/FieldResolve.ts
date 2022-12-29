import { Field, FieldEnv } from "../types";

export default class FieldResolve {

    public static resolve(fields: FieldEnv, name: string): Field | undefined {

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