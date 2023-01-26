type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'

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

export default class Logger {

    public static log(message: string, options?: { name?: string, color?: Color }, ...args: string[]): void {
        const date = new Date();
        const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        const name = options?.name ? `[${options.name}]` : '';
        const color = getColorCode(options?.color)
        console.log(`\x1b[${color}m[${time}]${name} ${message}\x1b[0m`, ...args);
    }

    public static error(message: string, options?: { name?: string }, ...args: string[]): void {
        Logger.log(message, { ...options, color: 'red' }, ...args);
    }

    public static warn(message: string, options?: { name?: string }, ...args: string[]): void {
        Logger.log(message, { ...options, color: 'yellow' }, ...args);
    }

    public static info(message: string, options?: { name?: string }, ...args: string[]): void {
        Logger.log(message, { ...options, color: 'blue' }, ...args);
    }
}