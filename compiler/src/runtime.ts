import { Program, Node, ConstantDeclaration, Value, ValueNode } from "./types";

class RuntimeError extends Error {
    constructor(message: string) {
        super(message);
    }
}

type MemoryValue = {
    ready: boolean,
    value: Buffer | undefined,
    debug?: string,
}

class Fields {
    private readonly fields: Map<string, number> = new Map();

    public get(key: string) {
        if(!this.fields.has(key)) throw new RuntimeError(`Field ${key} not found`)
        const result = this.fields.get(key);
        if(result === undefined) throw new RuntimeError(`Unexpected undefined field ${key}`)
        return result;
    }

    public set(key: string, value: number): void {
        console.log('[Fields] set', key, value);
        this.fields.set(key, value);
    }
}

class Memory {
    
    private readonly memory: Map<number, MemoryValue> = new Map();
    private currentAddress: number = 0;

    public get(key: number): MemoryValue | undefined {
        return this.memory.get(key);
    }

    public set(key: number, value: MemoryValue): void {
        console.log('[Memory] set', key, value);
        this.memory.set(key, value);
    }

    public allocate(): number {
        while(this.memory.has(this.currentAddress)) {
            if(this.currentAddress++ > 1000) {
                if(this.memory.entries.length >= 1000) throw new RuntimeError('Memory overflow');
                this.currentAddress = 0;
            }
        }
        return this.currentAddress++;
    }

    public free(address: number) {
        this.memory.delete(address);
        this.currentAddress = address;
    }

    public get entries(){
        return this.memory.entries();
    }
}

class Thread {

    private readonly _scheduler: Scheduler;
    private readonly _memory: Memory;
    private readonly _fields: Fields;

    private readonly threadId: number;

    private readonly queue: Array<() => Promise<MemoryValue>> = [];

    private _interrupted: boolean = false;
    private _stopped: boolean = false;

    constructor(scheduler: Scheduler, memory: Memory, fields: Fields, threadId: number) {
        this._scheduler = scheduler
        this._memory = memory;
        this._fields = fields;

        this.threadId = threadId;
    }

    public add(node: Value) {
        this.queue.push(() => {
            console.log(node, this.threadId);
            return runValue(node, this._memory, this._fields);
        });
    }

    public run() {
        console.log('run', this.threadId);
        return new Promise<MemoryValue | undefined>(async resolve => {
            // await unitl items are in queue
            while(this.queue.length === 0 && this.isAlive) {}
            if(!this.isAlive) return resolve(undefined)
            // execute next item
            const next = this.queue.shift();
            if(next) {
                const result = await next()
                resolve(result);
            }
            else resolve(undefined);
        })
    }

    public interrupt(): void {
        this._interrupted = true;
    }

    public stop(): void {
        this._stopped = true;
    }

    public get isAlive(): boolean {
        return !this._stopped && !this._interrupted;
    }

    public get isRunning(): boolean {
        return this.isAlive && this.queue.length > 0;
    }
}

class Scheduler {

    private readonly _memory: Memory;
    private readonly _fields: Fields;

    private readonly threads: Array<Thread> = [];

    private nextThreadId: number = 0;

    constructor(memory: Memory, fields: Fields) {
        this._memory = memory;
        this._fields = fields;

        // add main thread
        const main = new Thread(this, this._memory, this._fields, 0);
        this.threads.push(main);
    }

    public async run() {
        while(this.threads.length > 0) {
            const threads = this.threads[this.nextThreadId]
            if(threads.isAlive) await threads.run();
            else this.threads.splice(this.nextThreadId, 1);
            // determine next thread
            // TODO: find strategy to determine next thread
            this.nextThreadId = (this.nextThreadId + 1) % this.threads.length;
        }
    }

    public spawn() {
        const thread = new Thread(this, this._memory, this._fields, this.threads.length);
        this.threads.push(thread);
        return thread;
    }

    public stop(thread?: number) {
        if(thread) this.threads[thread].stop();
        else this.threads.forEach(thread => thread.stop());
    }

    public resolveValue(value: Value, memCallback: (resolved: MemoryValue) => void) {
        return new Promise<void>(resolve => {
            const timeout = setTimeout(() => {
                memCallback({ ready: false, value: undefined });
                resolve();
            }, 1);
            // await resolving
            runValue(value, this._memory, this._fields).then(resolved => {
                clearTimeout(timeout);
                memCallback(resolved);
                resolve();
            })
        })
    }
}

export default class Runtime {

    private readonly syntax_tree: Program

    private readonly scheduler: Scheduler
    private readonly memory: Memory;
    private readonly fields: Fields;

    constructor(syntax_tree: Program) {
        this.syntax_tree = syntax_tree;

        this.memory = new Memory();
        this.fields = new Fields();
        this.scheduler = new Scheduler(this.memory, this.fields);
    }

    public async run() {
        for(const statement of this.syntax_tree) {
            await runNode(statement, this.memory, this.fields, this.scheduler);
        }
    }
}

function toBuffer(value: Value): Buffer {
    switch(value.type) {
        case 'literal': {
            // TODO: int and float should not be buffers
            return Buffer.from(value.literal.toString());
        }
    }
    throw new Error(`Unknown node type: ${value.type}`);
}

function sleeep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function runValue(node: Value, memory: Memory, fields: Fields) {
    return new Promise<MemoryValue>(async resolve => {
        await sleeep(1000);
        switch(node.type) {
            case 'literal': return resolve({ ready: true, value: toBuffer(node), debug: node.literal.toString() });
        }
        throw new Error(`Unknown node type: ${node.type}`);
    })
}

async function runNode(node: Node, memory: Memory, fields: Fields, scheduler: Scheduler) {
    switch(node.type) {
        case 'constantDeclaration': return await runConstantDeclaration(node, memory, fields, scheduler)
    }
    throw new Error(`Unknown node type: ${node.type}`);
}

function runConstantDeclaration(node: ConstantDeclaration, memory: Memory, fields: Fields, scheduler: Scheduler) {

    const { name, value } = node;

    if(value.type === 'reference') {
        const field = fields.get(value.reference);
        fields.set(name, field);
    }
    else {
        const address = memory.allocate();
        fields.set(name, address);
        scheduler.resolveValue(value, resolved => {
            memory.set(address, resolved)
        });
    }
}