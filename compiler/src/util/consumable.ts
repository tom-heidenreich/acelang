type Consumer<T, E> = (arg: T) => E

export class Consumable<T, E = void> {

    private readonly _consumer: Consumer<T, E>;
    private readonly _revert: (arg: T) => E | void;
    
    private consumed: boolean = false;

    constructor(consumer: Consumer<T, E>, revert?: (arg: T) => E) {
        this._consumer = consumer;
        this._revert = (arg) => {
            this.consumed = false;
            if(!revert) return
            return revert(arg);
        }
    }

    public consume(arg: T): E {
        if(this.consumed) {
            throw new Error('Consumable already consumed');
        }
        this.consumed = true;
        return this._consumer(arg);
    }

    public revert(arg: T): E | void {
        if(!this.consumed) {
            throw new Error('Consumable not consumed');
        }
        return this._revert(arg);
    }

    public get isConsumed(): boolean {
        return this.consumed;
    }
}