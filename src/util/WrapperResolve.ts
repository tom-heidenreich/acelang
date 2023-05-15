import { Field, Wrappers } from "../types";

export default class WrapperResolve {

    public static is(wrappers: Wrappers, ...match: ('returnable' | 'breakable' | 'continuable')[]): boolean {
        const current = wrappers.current
        for(const key of match) if(current[key]) return true

        // check parent
        if(wrappers.parent) return WrapperResolve.is(wrappers.parent, ...match)
        
        return false
    }

    public static resolveReturnableField(wrappers: Wrappers): Field | undefined {
        const current = wrappers.current
        if(current.returnableField) return current.returnableField

        // check parent
        if(wrappers.parent) return WrapperResolve.resolveReturnableField(wrappers.parent)
        
        return undefined
    }
}