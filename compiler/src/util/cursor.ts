export default class Cursor<T> {

    private cursor = 0;
    private readonly array: T[];

    constructor(array: T[], offset?: number) {
        this.array = array;
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
}