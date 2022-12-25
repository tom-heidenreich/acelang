export default class Cursor<T> {

    private cursor = 0;
    private readonly array: T[];

    constructor(array: T[], offset?: number) {
        this.array = array || [];
        if(offset) this.cursor = offset;
    }

    public next() {
        if(this.cursor >= this.array.length) throw new Error('Cursor out of bounds');
        return this.array[this.cursor++];
    }

    public peek() {
        if(this.cursor >= this.array.length) throw new Error('Cursor out of bounds');
        return this.array[this.cursor];
    }

    public rollback() {
        if(this.cursor <= 0) throw new Error('Cursor out of bounds');
        this.cursor--;
        return this.array[this.cursor];
    }

    public reachedEnd() {
        return this.cursor >= this.array.length;
    }

    public remaining(): Cursor<T> {
        const cursor = this.cursor;
        this.cursor = this.array.length;
        return new Cursor(this.array, cursor);
    }

    public asList(): T[] {
        return this.array.slice(this.cursor);
    }
}

export class WriteCursor<T> {

    private cursor = 0;
    private readonly array: T[];

    constructor(array: T[], offset?: number) {
        this.array = array || [];
        if(offset) this.cursor = offset;
    }

    public push(...values: T[]) {
        for(const value of values) {
            this.array[this.cursor++] = value;
        }
    }

    public rollback() {
        if(this.cursor <= 0) throw new Error('Cursor out of bounds');
        this.cursor--;
        return this.array[this.cursor];
    }

    public asList(): T[] {
        return this.array.slice(0, this.cursor);
    }

    public clear() {
        this.cursor = 0;
    }

    public size() {
        return this.cursor;
    }
}