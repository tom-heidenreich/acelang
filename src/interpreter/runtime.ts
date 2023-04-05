import { Statement, VariableDeclaration, Value, FunctionDeclaration, ReturnStatement } from "../types";
import { Convert, FromBits, ToBits, findIndexOfArrayInArray } from "./bit_utils";

const RESERVED_NAMES = {
    'return': '_sys::return'
}

const TIMEOUT = 10

export default class Runtime {

    private context: Context;
    public readonly objects: Objects;

    constructor() {
        this.context = new Context();
        this.objects = new Objects();
    }

    public run({ statements, context, shouldContinue }: { statements: Statement[], context?: Context, shouldContinue?: () => boolean }): Promise<void> {
        return new Promise<void>(async resolve => {

            if(!context) context = this.context;
            console.log(context.local);

            if(statements.length === 1) {
                const statementPromise = new Promise<void>(async resolve => {
                    if(!context) context = this.context;
                    const statement = statements[0];
                    if (statement.type === 'multiStatement') return resolve(await this.run({ statements: statement.statements, context, shouldContinue }));
                    switch(statement.type) {
                        case 'variableDeclaration': return resolve(await parseVariableDeclaration(statement, context, this));
                        case 'syncStatement': {
                            const newContext = new Context(context, true);
                            resolve(await this.run({ statements: statement.body, context: newContext }));
                            return;
                        }
                        case 'functionDeclaration': return resolve(await parseFunctionDeclaration(statement, context, this));
                        case 'returnStatement': return resolve(await parseReturnStatement(statement, context, this));
                    }
                    throw new Error(`Statement type ${statement.type} is not implemented`);
                })

                if(context.isSync) return resolve(await statementPromise);
                const timeout = setTimeout(resolve, TIMEOUT);
                statementPromise.then(() => {
                    clearTimeout(timeout);
                    resolve();
                });
                return;
            }

            for(const statement of statements) {
                await this.run({ statements: [statement], context, shouldContinue });
                if(shouldContinue && !shouldContinue()) return resolve();
                console.log('=======================');
                this.printDebug();
                console.log('=======================');
            }
            return resolve();
        });
    }

    public async resolveValue(value: Value, context: Context) {
        const objectId = parseAsyncValue({ value, objects: this.objects, context, runtime: this })
        if(context.isSync) await this.objects.get(objectId);
        return objectId;
    }

    public collectGarbage() {
        // TODO: currently collects items in arrays or structs as well
        const context = this.context;
        const usedAddresses = new Set<number>();
        const collect = (context: Context) => {
            for(const address of context.local.values()) usedAddresses.add(address);
            if(context.parent) collect(context.parent);
        }
        collect(context);
        for(const address of this.objects.objects.keys()) {
            if(!usedAddresses.has(address)) this.objects.free(address);
        }
    }

    public printDebug() {
        console.log(this.context.local);
        console.log(this.objects.objects);
    }
}

export type RuntimeMemoryType = Uint8Array
export const RuntimeMemoryObject = Uint8Array

class Context {

    public parent?: Context;
    public local: Map<string, number> = new Map();

    public readonly isSync: boolean;

    constructor(parent?: Context, isSync: boolean = false) {
        this.parent = parent;
        this.isSync = isSync;
    }

    public get(name: string): number {
        if(this.local.has(name)) return this.local.get(name)!;
        if(this.parent) return this.parent.get(name);
        throw new Error(`Variable ${name} is not defined`);
    }

    public set(name: string, address: number): void {
        console.log(`Set ${name} to ${address}`);
        this.local.set(name, address);
    }
}

function intAdd(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.int64(firstInt + secondInt);
}

function floatAdd(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.float64(firstFloat + secondFloat);
}

function stringConcat(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstString = FromBits.string(first);
    const secondString = FromBits.string(second);
    return ToBits.string(firstString + secondString);
}

function intMultiply(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.int64(firstInt * secondInt);
}

function floatMultiply(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.float64(firstFloat * secondFloat);
}

function intLessThan(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.boolean(firstInt < secondInt);
}

function intLessThanEquals(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.boolean(firstInt <= secondInt);
}

function intGreaterThan(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.boolean(firstInt > secondInt);
}

function intGreaterThanEquals(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstInt = FromBits.int64(first);
    const secondInt = FromBits.int64(second);
    return ToBits.boolean(firstInt >= secondInt);
}

function floatLessThan(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.boolean(firstFloat < secondFloat);
}

function floatLessThanEquals(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.boolean(firstFloat <= secondFloat);
}

function floatGreaterThan(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.boolean(firstFloat > secondFloat);
}

function floatGreaterThanEquals(first: RuntimeMemoryType, second: RuntimeMemoryType): RuntimeMemoryType {
    const firstFloat = FromBits.float64(first);
    const secondFloat = FromBits.float64(second);
    return ToBits.boolean(firstFloat >= secondFloat);
}

type ValueResolvePromise = Promise<RuntimeMemoryType>
type RuntimeObject = {
    resolved: boolean;
    promise: ValueResolvePromise;
    data?: RuntimeMemoryType;
}

class Objects {

    public readonly objects: Map<number, RuntimeObject> = new Map();
    public readonly functions: Map<number, FunctionDeclaration> = new Map();

    public get(address: number): Promise<RuntimeMemoryType> {
        const object = this.objects.get(address);
        if(object) {
            if(object.resolved) return new Promise(resolve => resolve(object.data!));
            return new Promise(async resolve => {
                object.data = await object.promise
                object.resolved = true;
                resolve(object.data);
            })
        }
        throw new Error(`Object ${address} is not defined`);
    }

    public getWithoutResolving(address: number): RuntimeObject {
        const object = this.objects.get(address);
        if(object) return object;
        throw new Error(`Object ${address} is not defined`);
    }

    public set(address: number, promise: ValueResolvePromise): void {
        this.objects.set(address, {
            resolved: false,
            promise,
        });
    }

    public free(address: number): void {
        this.objects.delete(address);
    }

    private findFreeAddress(map: Map<number, any>): number {
        let address = 0;
        while(map.has(address)) address++;
        return address;
    }

    public allocate(): number {
        const address = this.findFreeAddress(this.objects);
        this.objects.set(address, {
            resolved: false,
            promise: new Promise(resolve => resolve(new RuntimeMemoryObject(0)))
        });
        return address;
    }

    public dynamicAllocate(data: RuntimeMemoryType): number {
        const address = this.findFreeAddress(this.objects);
        this.objects.set(address, {
            resolved: true,
            promise: new Promise(resolve => resolve(data)),
            data
        });
        return address;
    }

    public getFunction(address: number) {
        return this.functions.get(address);
    }

    public allocateFunction(declaration: FunctionDeclaration): number {
        const address = this.findFreeAddress(this.functions);
        this.functions.set(address, declaration);
        return address;
    }
}

function parseAsyncValue({ value, objects, context, runtime }: { value: Value, objects: Objects, context: Context, runtime: Runtime }): number {
    switch(value.type) {
        case 'undefined': return objects.dynamicAllocate(ToBits.undefined());
        case 'literal': {
            switch(value.literalType) {
                case 'int': return objects.dynamicAllocate(ToBits.int64(value.literal as number));
                case 'float': return objects.dynamicAllocate(ToBits.float64(value.literal as number));
                case 'boolean': return objects.dynamicAllocate(ToBits.boolean(value.literal as boolean));
                case 'string': return objects.dynamicAllocate(ToBits.string(value.literal as string));
            }
        }
        case 'array': return objects.dynamicAllocate(ToBits.int8Array(value.items.map(item => parseAsyncValue({ value: item, objects, context, runtime }))));
        case 'struct': {
            const keys = Object.keys(value.properties);
            const valueAddresses = ToBits.int8Array(keys.map(key => parseAsyncValue({ value: value.properties[key], objects, context, runtime })));
            const buffer: number[] = []
            for(let i = 0; i < keys.length; i++) {
                buffer.push(...ToBits.string(keys[i]));
                buffer.push(...ToBits.string(':'));
                // simulate 16 bit
                buffer.push(0)
                buffer.push(valueAddresses[i]);
            }
            return objects.dynamicAllocate(ToBits.int8Array(buffer));
        }
        case 'cast': {
            const target = parseAsyncValue({ value: value.value, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const targetData = await objects.get(target);
                switch(value.currentType) {
                    case 'int': {
                        switch(value.targetType) {
                            case 'float': return resolve(Convert.int64tofloat64(targetData));
                            case 'string': return resolve(Convert.int64tostring(targetData));
                        }
                    }
                    case 'float': {
                        switch(value.targetType) {
                            case 'int': return resolve(Convert.float64toint64(targetData));
                            case 'string': return resolve(Convert.float64tostring(targetData));
                        }
                    }
                    case 'string': {
                        switch(value.targetType) {
                            case 'int': return resolve(Convert.stringtoint64(targetData));
                            case 'float': return resolve(Convert.stringtofloat64(targetData));
                        }
                    }
                }
                throw new Error(`Cannot cast ${value.currentType} to ${value.targetType}`);
            }));
            return address;
        }
        case 'intAdd': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intAdd(leftData, rightData));
            }));
            return address;
        }
        case 'floatAdd': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatAdd(leftData, rightData));
            }));
            return address;
        }
        case 'stringConcat': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(stringConcat(leftData, rightData));
            }));
            return address;
        }
        case 'intMultiply': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intMultiply(leftData, rightData));
            }));
            return address;
        }
        case 'floatMultiply': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatMultiply(leftData, rightData));
            }));
            return address;
        }
        case 'intLessThan': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intLessThan(leftData, rightData));
            }));
            return address;
        }
        case 'intLessThanEquals': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intLessThanEquals(leftData, rightData));
            }));
            return address;
        }
        case 'intGreaterThan': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intGreaterThan(leftData, rightData));
            }));
            return address;
        }
        case 'intGreaterThanEquals': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(intGreaterThanEquals(leftData, rightData));
            }));
            return address;
        }
        case 'floatLessThan': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatLessThan(leftData, rightData));
            }));
            return address;
        }
        case 'floatLessThanEquals': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatLessThanEquals(leftData, rightData));
            }));
            return address;
        }
        case 'floatGreaterThan': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatGreaterThan(leftData, rightData));
            }));
            return address;
        }
        case 'floatGreaterThanEquals': {
            const left = parseAsyncValue({ value: value.left, objects, context, runtime });
            const right = parseAsyncValue({ value: value.right, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const leftData = await objects.get(left);
                const rightData = await objects.get(right);
                resolve(floatGreaterThanEquals(leftData, rightData));
            }));
            return address;
        }
        case 'reference': return context.get(value.reference)
        case 'member': {
            const target = parseAsyncValue({ value: value.target, objects, context, runtime });
            const property = parseAsyncValue({ value: value.property, objects, context, runtime });
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const targetData = await objects.get(target);
                const propertyData = await objects.get(property);
                
                if(value.targetType.type === 'array') {
                    const valueAddress = targetData[FromBits.int64(propertyData)];
                    resolve(await objects.get(valueAddress));
                }
                else if(value.targetType.type === 'struct') {
                    const index = findIndexOfArrayInArray(targetData, propertyData);
                    if(index === -1) throw new Error(`Property ${FromBits.string(propertyData)} not found in struct`);
                    const valueAddress = targetData[index + 4];
                    resolve(await objects.get(valueAddress));
                }
                else throw new Error(`Unexpected member target type ${value.targetType.type}`);
            }));
            return address;
        }
        case 'call': {
            const target = parseAsyncValue({ value: value.callable, objects, context, runtime });
            const args = value.args.map(arg => parseAsyncValue({ value: arg, objects, context, runtime }));
            const address = objects.allocate();
            objects.set(address, new Promise(async resolve => {
                const targetData = await objects.get(target);

                // find _callable
                const callableValueIndex = findIndexOfArrayInArray(targetData, ToBits.string('_callable'));
                if(callableValueIndex === -1) throw new Error(`Object is not callable`);
                const callableValueAddress = targetData[callableValueIndex + 4];
                const callableAddress = FromBits.int64(await objects.get(callableValueAddress));

                const callable = objects.getFunction(callableAddress);
                if(!callable) throw new Error(`Function at address ${callableAddress} not found`);

                const callContext = new Context(context);
                for(let i = 0; i < callable.params.length; i++) {
                    callContext.set(callable.params[i].name, args[i]);
                }

                // set return to undefined
                callContext.set(RESERVED_NAMES.return, -1);

                // call function
                await runtime.run({
                    statements: callable.body,
                    context: callContext,
                    shouldContinue: () => {
                        // continue if not returned yet
                        const returnValueAddress = callContext.get(RESERVED_NAMES.return);
                        return returnValueAddress === -1;
                    }
                });

                // resolve return value
                const returnValueAddress = callContext.get(RESERVED_NAMES.return);
                if(returnValueAddress === -1) return resolve(ToBits.undefined());
                resolve(await objects.get(returnValueAddress));
            }));
            return address;
        }
    }
    throw new Error(`Value type ${value.type} is not implemented`);
}

async function parseVariableDeclaration(statement: VariableDeclaration, context: Context, runtime: Runtime) {
    const { name, value } = statement;
    if(!value) return context.set(name, -1);
    context.set(name, await runtime.resolveValue(value, context))
}

async function parseFunctionDeclaration(statement: FunctionDeclaration, context: Context, runtime: Runtime) {
    const { name } = statement;
    const address = runtime.objects.allocateFunction(statement);
    context.set(name, await runtime.resolveValue({
        type: 'struct',
        properties: {
            _callable: {
                type: 'literal',
                literalType: 'int',
                literal: address
            }
        }
    }, context));
}

async function parseReturnStatement(statement: ReturnStatement, context: Context, runtime: Runtime) {
    const valueAddress = await runtime.resolveValue(statement.value, context)
    context.set(RESERVED_NAMES.return, valueAddress);
}