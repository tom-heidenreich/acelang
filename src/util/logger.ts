import * as fs from 'fs';

type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'
type LogType = 'log' | 'error' | 'warn' | 'info'

function getColorCode(color?: Color): string {
    if (!color) return '0'
    switch (color) {
        case 'black': return '30'
        case 'red': return '31'
        case 'green': return '32'
        case 'yellow': return '33'
        case 'blue': return '34'
        case 'magenta': return '35'
        case 'cyan': return '36'
        case 'white': return '37'
        case 'gray': return '90'
    }
}

function formattedType(type?: LogType): string {
    // all strings should be the same length
    switch(type) {
        case 'log': return '<log>  '
        case 'error': return '<error>'
        case 'warn': return '<warn> '
        case 'info': return '<info> '
        default: return '<log>  '
    }
}

export default class Logger {

    private readonly logToFile: boolean = false;
    private readonly logFile: string;

    private readonly isSilent: boolean = false;
    public readonly detail: number = 0;

    constructor(logToFile: boolean = false, logFile: string = 'log.txt', isSilent: boolean = false, detail: number = 0) {
        this.isSilent = isSilent;
        this.logToFile = logToFile;
        this.logFile = logFile;
        this.detail = detail;
    }

    public log(message: string, options: { name?: string, color?: Color, type?: LogType, detail?: number }={}, ...args: string[]): void {

        if(options.detail && options.detail > this.detail) return;
        
        const date = new Date();
        const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        const name = options.name ? `[${options.name}]` : '';
        const color = getColorCode(options?.color)
        if(!this.isSilent || options.type === 'error') console.log(`\x1b[${color}m[${time}]${name} ${message}\x1b[0m`, ...args);
        
        if(this.logToFile) {
            fs.appendFileSync(this.logFile, `[${time}]${name} ${formattedType(options.type)} ${message}\n`);
        }
    }

    public error(message: string, options?: { name?: string }, ...args: string[]): void {
        this.log(message, { ...options, color: 'red', type: 'error', detail: 0 }, ...args);
    }

    public warn(message: string, options?: { name?: string }, ...args: string[]): void {
        this.log(message, { ...options, color: 'yellow', type: 'warn', detail: 0 }, ...args);
    }

    public info(message: string, options?: { name?: string }, ...args: string[]): void {
        this.log(message, { ...options, color: 'blue', type: 'info', detail: 0 }, ...args);
    }

    public obj(obj: any, options?: { name?: string, color?: Color, type?: LogType, detail?: number }): void {
        this.log(JSON.stringify(obj, null, 4), options);
    }
}