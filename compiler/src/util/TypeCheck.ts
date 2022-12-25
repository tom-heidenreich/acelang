import { DataType } from "../types";

export default class TypeCheck {

    public static matches(match: DataType, against: DataType): boolean {
        if(match === against) return true;
        else if(match === 'any' || against === 'any') return true;
        return false;
    }
}