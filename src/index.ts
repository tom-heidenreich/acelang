import path from 'path';
import { program } from 'commander';
import * as fs from 'fs';
import Logger from './util/logger';
import compile from './compiler';
import { initModuleManager } from './modules';
import { generateModule } from './compiler/modules';

process.env.FILE_EXTENSION = 'ace';

// read command line arguments
program
    .version('0.0.1')
    .name('ACE')
    .usage('[options] <file>')

program.command('module <file>')
    .option('-o, --output <file>', 'output the result to a file')
    .option('-l, --log', 'log the output to a file', false)
    .option('-s, --silent', 'do not log the output to the console', false)
    .action((file_input, options) => {
        if(options.details) options.details = parseInt(options.details);
        
        const LOGGER = new Logger(options?.log, 'log.txt', options?.silent, options?.details);
        // create log file if log is enabled
        if(options?.log) fs.writeFileSync('log.txt', '');

        // moduler
        const {
            moduleManager,
            workDir,
            fileName,
            file
        } = initModuleManager(file_input, LOGGER)

        generateModule(workDir, fileName, moduleManager, LOGGER, {
            output: options.output as string,
        });
    })

program.command('compile <file>')
    .description('compile a file')

    .option('-r, --run', 'run the file', false)
    .option('-d, --debug', 'run the file in debug mode', false)
    .option('-l, --log', 'log the output to a file', false)
    .option('-o, --output <file>', 'output the result to a file')
    .option('-s, --silent', 'do not log the output to the console', false)
    .option('-w, --watch', 'watch the file for changes', false)
    .option('-disable-stack-probes', 'disable stack probes', false)
    .action((file_input, options) => {
        if(options.details) options.details = parseInt(options.details);
        
        const LOGGER = new Logger(options?.log, 'log.txt', options?.silent, options?.details);
        // create log file if log is enabled
        if(options?.log) fs.writeFileSync('log.txt', '');

        // moduler
        const {
            moduleManager,
            workDir,
            fileName,
            file,
        } = initModuleManager(file_input, LOGGER)

        const action = () => compile(workDir, fileName, moduleManager, LOGGER, {
            output: options.output as string,
            execute: options.run,
            noStackProbes: options.DisableStackProbes,
        });

        if(options.watch) {
            LOGGER.info(`Watching file ${fileName}`);
            fs.watchFile(path.join(file), { interval: 1000 }, () => {
                LOGGER.info(`Found changes in ${fileName}`);
                LOGGER.log(`> Re-compiling...`);
                LOGGER.log(``);
                action();
            })
        }

        action();
    })

program.parse(process.argv);