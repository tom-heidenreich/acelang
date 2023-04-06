export default class StringBuffer {

    private _buffer: string = '';

    public append(value: string): void {
        this._buffer += value;
    }

    public clear(): string {
        const buffer = this._buffer;
        this._buffer = '';
        return buffer;
    }

    public size(): number {
        return this._buffer.length;
    }

    public isEmpty(): boolean {
        return this._buffer.length === 0;
    }

    public toString(): string {
        return this._buffer;
    }
}