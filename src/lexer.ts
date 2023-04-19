import { WriteCursor } from "./util/cursor"
import { Consumer, LexerAddon, Token, TokenLine, Tokenizer } from "./types"
import { lineInfo } from "./util/LineStringify";
import { DEFAULT_LEXER_ADDON } from "./addons/lexer_addons";

export class Controller {

    public readonly lexer: Lexer;

    private currentStructure: string | undefined = undefined;
        
    private cursor = new WriteCursor<Token[]>();
    private lineCursor = new WriteCursor<Token>();
    private bufferCursor = new WriteCursor<string>();

    private sharedResources: Map<string, any> = new Map();

    private startLine = 0;
    private startCol = 0;

    private currentLine = 0;
    private currentCol = 0;

    private file: string

    constructor(lexer: Lexer, startLine: number, startCol: number, file: string) {
        this.lexer = lexer;

        this.currentLine = startLine;
        this.currentCol = startCol;
        this.file = file;
    }

    public setStructure (structure: string | undefined) {
        this.currentStructure = structure;

        this.startLine = this.currentLine;
        this.startCol = this.currentCol;
    }

    public append (c: string) {
        this.bufferCursor.push(c);
    }

    public createToken () {
        const tokenizer = this.lexer.registeredTokenizers.get(this.currentStructure || 'none');

        if(!tokenizer) throw new Error(`No tokenizer for structure ${this.currentStructure || 'none'}`);
        
        const value = this.bufferCursor.asList().join('');
        this.bufferCursor.clear();
        
        const token = tokenizer(value, this);

        if(!token) return;  // tokenizer does not accept value

        // validate token
        if(!this.lexer.getRegisteredTokenTypes().includes(token.type)) throw new Error(`Unregistered token type ${token.type}`);
        if(token.type === 'symbol' && !this.lexer.getRegisteredSymbols().includes(token.value)) throw new Error(`Unregistered symbol ${token.value}`);
        if(token.type === 'operator' && !this.lexer.getRegisteredOperators().includes(token.value)) throw new Error(`Unregistered operator ${token.value}`);
        if(token.type === 'keyword' && !this.lexer.getRegisteredKeywords().includes(token.value)) throw new Error(`Unregistered keyword ${token.value}`);
        if(token.type === 'datatype') {
            if(!token.specificType) throw new Error(`datatype token ${token.value} does not have specificType`);
            if(!this.lexer.getRegisteredDataTypes().includes(token.specificType)) throw new Error(`Unregistered datatype ${token.specificType}`);
        }

        this.lineCursor.push({
            ...token,
            lineInfo: {
                line: this.startLine,
                char: this.startCol,
                endLine: this.currentLine,
                endChar: this.currentCol,
                file: this.file
            }
        });
    }

    public newLine () {
        const line = this.lineCursor.asList();
        if(line.length === 0) return;
        this.cursor.push(line);
        this.lineCursor.clear();
    }

    public countLine () {
        this.currentLine++;
        this.currentCol = 0;
    }

    public countCol () {
        this.currentCol++;
    }

    public get line(): TokenLine {
        return {
            line: this.startLine,
            char: this.startCol,
            endLine: this.currentLine,
            endChar: this.currentCol,
            file: this.file
        }
    }

    public get buffer() {
        return this.bufferCursor.asList().join('');
    }

    public get structure() {
        return this.currentStructure;
    }

    public get tokens () {
        return this.cursor.asList();
    }

    public get shared() {
        return this.sharedResources;
    }
}

export default class Lexer {

    private consumers: Map<string | undefined, Consumer[]> = new Map();
    private tokenizers: Map<string, Tokenizer> = new Map();

    private registeredTokenTypes: string[] = [];
    private registeredSymbols: string[] = [];
    private registeredOperators: string[] = [];
    private registeredKeywords: string[] = [];
    private registeredDataTypes: string[] = [];

    private file: string;

    constructor(file: string, disableDefault: boolean = false) {
        this.file = file;
        if(!disableDefault) this.addAddon(DEFAULT_LEXER_ADDON)
    }

    public addAddon(addon: LexerAddon) {

        for(const consumer of addon.consumers) {
            // modify consumer id
            consumer.consumer.id = `${addon.name}.${consumer.consumer.id || '<anonymous>'}`;

            if(!this.consumers.has(consumer.structure)) {
                this.consumers.set(consumer.structure, []);
            }
            const consumers = this.consumers.get(consumer.structure);
            if(!consumers) throw new Error("Unexpected error");
            consumers.push(consumer.consumer);
        }

        if(addon.tokenizers) {
            for(const [key, value] of Object.entries(addon.tokenizers)) {
                if(this.tokenizers.has(key)) throw new Error(`Tokenizer ${key} is already defined`);
                this.tokenizers.set(key, value);
            }
        }

        if(addon.register) {
            if(addon.register.tokenTypes) this.registeredTokenTypes.push(...addon.register.tokenTypes);
            if(addon.register.symbols) this.registeredSymbols.push(...addon.register.symbols);
            if(addon.register.operators) this.registeredOperators.push(...addon.register.operators);
            if(addon.register.keywords) this.registeredKeywords.push(...addon.register.keywords);
            if(addon.register.dataTypes) this.registeredDataTypes.push(...addon.register.dataTypes);
        }
    }

    public get registeredTokenizers() {
        return this.tokenizers
    }

    public lex(content: string, startLine: number = 1, startCol: number = 0) {

        const controller = new Controller(this, startLine, startCol, this.file);

        for(const c of content) {
            controller.countCol();
            if(c === '\n') controller.countLine();
            
            let consumers: Consumer[] = this.collectConsumers(controller.structure);
            let previousStructure: string | undefined = controller.structure;
            
            let index = 0;
            while(true) {
                if(index >= consumers.length) throw new Error(`No consumer accepted ${c} in structure ${controller.structure} at ${lineInfo(controller.line)}`);
                if(consumers[index].accept(c, controller)) {
                    const consumer = consumers[index];
                    if(consumer.willConsume(c)) {
                        if(!consumer.onConsume) throw new Error(`consumer ${consumer.id} does not have onConsume method`);
                        consumer.onConsume(c, controller);
                        break
                    }
                    if(!consumer.onChar) throw new Error(`consumer ${consumer.id} does not have onChar method`);
                    consumer.onChar(c, controller);
                }
                if(previousStructure !== controller.structure) {
                    consumers = this.collectConsumers(controller.structure);
                    previousStructure = controller.structure;
                    index = 0;
                    continue;
                }
                index++;
            }
        }
        
        controller.createToken();
        controller.newLine();
        
        return controller.tokens
    }

    public collectConsumers(structure: string | undefined) {
        const consumers =this.consumers.get(structure) || [];
        // add default consumers
        const defaultconsumers = this.consumers.get('*');
        if(defaultconsumers) consumers.push(...defaultconsumers);
        return consumers.sort((a, b) => {
            if(a.priority === undefined) return 1;
            if(b.priority === undefined) return -1;
            return b.priority - a.priority;
        });
    }

    public getRegisteredTokenTypes() {
        return [...this.registeredTokenTypes];
    }

    public getRegisteredSymbols() {
        return [...this.registeredSymbols, ...this.registeredOperators];
    }

    public getRegisteredOperators() {
        return [...this.registeredOperators];
    }

    public getRegisteredKeywords() {
        return [...this.registeredKeywords];
    }

    public getRegisteredDataTypes() {
        return [...this.registeredDataTypes];
    }
}