import { RuntimeMemoryObject, RuntimeMemoryType } from "./runtime";

export const ToBits = {
    undefined: () => new RuntimeMemoryObject(0),
    boolean: (value: boolean) => new RuntimeMemoryObject([value ? 1 : 0]),
    int16: (value: number) => {
        const bytes = new RuntimeMemoryObject(2);
        for(let i = 0; i < 2; i++) bytes[i] = (value >> (8 - (i * 8))) & 0xFF;
        return bytes
    },
    int64: (value: number) => {
        const bytes = new RuntimeMemoryObject(8);
        for(let i = 0; i < 8; i++) bytes[i] = (value >> (56 - (i * 8))) & 0xFF;
        return bytes
    },
    float64: (value: number) => {
        const bytes = new RuntimeMemoryObject(8);
        const view = new DataView(bytes.buffer);
        view.setFloat64(0, value);
        return bytes
    },
    int8Array: (value: number[]) => {
        const bytes = new RuntimeMemoryObject(value.length);
        for(let i = 0; i < value.length; i++) bytes[i] = value[i] & 0xFF;
        return bytes;
    },
    int16Array: (value: number[]) => {
        const bytes = new RuntimeMemoryObject(value.length * 2);
        for(let i = 0; i < value.length; i++) {
            for(let j = 0; j < 2; j++) bytes[(i * 2) + j] = (value[i] >> (8 - (j * 8))) & 0xFF;
        }
        return bytes;
    },
    string: (value: string) => ToBits.int16Array(value.split('').map(char => char.charCodeAt(0)))
}

export const FromBits = {
    boolean: (value: RuntimeMemoryType): boolean => value[0] === 1,
    int16: (value: RuntimeMemoryType): number => {
        let result = 0;
        for(let i = 0; i < 2; i++) result |= value[i] << (8 - (i * 8));
        return result;
    },
    int64: (value: RuntimeMemoryType): number => {
        let result = 0;
        for(let i = 0; i < 8; i++) result |= value[i] << (56 - (i * 8));
        return result;
    },
    float64: (value: RuntimeMemoryType): number => {
        const view = new DataView(value.buffer);
        return view.getFloat64(0);
    },
    int8Array: (value: RuntimeMemoryType): number[] => {
        const result: number[] = [];
        for (let i = 0; i < value.length; i++) result.push(value[i]);
        return result;
    },
    int16Array: (value: RuntimeMemoryType): number[] => {
        const result: number[] = [];
        for (let i = 0; i < value.length; i += 2) result.push(FromBits.int16(value.slice(i, i + 2)));
        return result;
    },
    string: (value: RuntimeMemoryType): string => String.fromCharCode(...FromBits.int16Array(value))
}

export const Convert = {
    int64tofloat64: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.float64(FromBits.int64(value));
    },
    float64toint64: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.int64(FromBits.float64(value));
    },
    int64tostring: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.string(FromBits.int64(value).toString());
    },
    stringtoint64: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.int64(parseInt(FromBits.string(value)));
    },
    float64tostring: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.string(FromBits.float64(value).toString());
    },
    stringtofloat64: (value: RuntimeMemoryType): RuntimeMemoryType => {
        return ToBits.float64(parseFloat(FromBits.string(value)));
    }
}

export function findIndexOfArrayInArray(target: RuntimeMemoryType, search: RuntimeMemoryType): number {
    for (let i = 0; i < target.length - search.length + 1; i++) {
        let match = true;
        for (let j = 0; j < search.length; j++) {
            if (target[i + j] !== search[j]) {
                match = false;
                break;
            }
        }
        if(match) return i;
    }
    return -1;
}