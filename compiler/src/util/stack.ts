export default class Stack<E> {
    private elements: E[] = [];

    public push(element: E) {
        this.elements.push(element);
    }

    public popSafe(): E {
        const pop = this.pop();
        if(pop === undefined) {
            throw new Error('Cannot pop empty stack');
        }
        return pop;
    }

    public pop(): E | undefined {
        return this.elements.pop();
    }

    public get peek(): E {
        return this.elements[this.elements.length - 1];
    }

    public isEmpty(): boolean {
        return this.elements.length === 0;
    }

    public get size(): number {
        return this.elements.length;
    }
}

export class PriorityStack<E> {

    private elements: { value: E, priority: number }[] = [];

    public push(element: E, priority: number) {
        this.elements.push({ value: element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    public pop(): E {
        const pop = this.elements.pop();
        if(pop === undefined) {
            throw new Error('Cannot pop empty stack');
        }
        return pop.value;
    }

    public get peek(): E {
        return this.elements[this.elements.length - 1].value;
    }

    public isEmpty(): boolean {
        return this.elements.length === 0;
    }

    public get size(): number {
        return this.elements.length;
    }

    public get contents(): { value: E, priority: number }[] {
        return this.elements;
    }
}