class Field {

}

class Fields {

    private readonly parent: Fields | undefined
    private readonly _local: Map<string, Field> = new Map();

    constructor(parent?: Fields) {
        this.parent = parent;
    }

    public get(name: string): Field | undefined {
        return this._local.get(name) || this.parent?.get(name);
    }

    public set(name: string, field: Field) {
        this._local.set(name, field);
    }
}