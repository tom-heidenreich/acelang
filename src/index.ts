import path from 'path';
import { program } from 'commander';
import interpret from './interpreter';
import * as fs from 'fs';
import Logger from './util/logger';
import compile from './compiler';

process.env.FILE_EXTENSION = 'ace';
process.env.WORK_DIR = path.join(__dirname, '..', '..')

// read command line arguments
program
    .version('0.0.1')
    .name('ACE')
    .usage('[options] <file>')

program.command('compile <file>')
    .description('compile a file')

    .option('-r, --run', 'run the file', false)
    .option('-d, --debug', 'run the file in debug mode', false)
    .option('-l, --log', 'log the output to a file', false)
    .option('-o, --output <file>', 'output the result to a file')
    .option('-s, --silent', 'do not log the output to the console', false)
    .option('-w, --watch', 'watch the file for changes', false)
    .action((file, options) => {
        if(options.details) options.details = parseInt(options.details);
        
        const LOGGER = new Logger(options?.log, 'log.txt', options?.silent, options?.details);
        // create log file if log is enabled
        if(options?.log) fs.writeFileSync('log.txt', '');

        const action = () => compile('./', file, LOGGER, {
            output: options.output as string,
        });

        if(options.watch) {
            LOGGER.info(`Watching file ${file}`);
            fs.watchFile(path.join(file), { interval: 1000 }, () => {
                LOGGER.info(`Found changes in ${file}`);
                LOGGER.log(`> Re-compiling...`);
                LOGGER.log(``);
                action();
            })
        }

        action();
    })

program.command('run <file>')
    .description('run a file')

    .option('--details <level>', 'set the log detail level', '0')
    .option('-l, --log', 'log the output to a file', false)
    .option('-s, --silent', 'do not log the output to the console', true)
    .option('-w, --watch', 'watch the file for changes', false)
    .action((file, options) => {
        if(options.details) options.details = parseInt(options.details);
        
        const LOGGER = new Logger(options?.log, 'log.txt', options?.silent, options?.details);
        // create log file if log is enabled
        if(options?.log) fs.writeFileSync('log.txt', '');

        const action = () => interpret('./', file, LOGGER);

        if(options.watch) {
            LOGGER.info(`Watching file ${file}`);
            fs.watchFile(path.join(file), { interval: 1000 }, () => {
                LOGGER.info(`Found changes in ${file}`);
                LOGGER.log(`> Re-interpreting...`);
                LOGGER.log(``);
                action();
            })
        }

        action();
    })

program.parse(process.argv);