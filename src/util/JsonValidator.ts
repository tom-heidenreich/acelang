type Schema = {
    [key: string]: SchemaItem
}

type SchemaItem = PrimitiveSchema | ArraySchema | StructSchema | ObjectSchema;

type PrimitiveSchema = {
    type: 'string' | 'number' | 'boolean',
    required?: boolean,
    default?: string | number | boolean,
}

type ArraySchema = {
    type: 'array',
    items: SchemaItem,
    required?: boolean,
    default?: any[],
}

type StructSchema = {
    type: 'struct',
    properties: Schema,
    required?: boolean,
    default?: any,
}

type ObjectSchema = {
    type: 'object',
    values: SchemaItem,
    required?: boolean,
    default?: any,
}

export default function validate(json: any, schema: Schema) {
    const errors: string[] = [];
    for(const key in schema) {
        const item = schema[key];
        const value = json[key];
        if(item.required && value === undefined) {
            errors.push(`Missing required property '${key}'`);
            continue;
        }
        if(value === undefined && item.default) {
            json[key] = item.default;
            continue;
        }
        errors.push(...validateItem(item, value, key));
    }
    return errors;
}

function validateItem(item: SchemaItem, value: any, key?: string) {
    if(item.type === 'string') {
        if(typeof value !== 'string') {
            return [`Property '${key}' must be a string, but got ${typeof value}`];
        }
    } else if(item.type === 'number') {
        if(typeof value !== 'number') {
            return [`Property '${key}' must be a number, but got ${typeof value}`];
        }
    } else if(item.type === 'boolean') {
        if(typeof value !== 'boolean') {
            return [`Property '${key}' must be a boolean, but got ${typeof value}`];
        }
    } else if(item.type === 'array') {
        if(!Array.isArray(value)) {
            return [`Property '${key}' must be an array, but got ${typeof value}`];
        }
        const errors: string[] = [];
        for(const item of value) {
            errors.push(...validateItem(item, value));
        }
        return errors;
    } else if(item.type === 'struct') {
        if(typeof value !== 'object') {
            return [`Property '${key}' must be an object, but got ${typeof value}`];
        }
        return validate(value, item.properties);
    } else if(item.type === 'object') {
        if(typeof value !== 'object') {
            return [`Property '${key}' must be an object, but got ${typeof value}`];
        }
        const errors: string[] = [];
        for(const key in value) {
            errors.push(...validateItem(value[key], item.values));
        }
        return errors;
    }
    return [];
}