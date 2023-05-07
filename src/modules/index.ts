import * as fs from 'fs';
import path from 'path';
import { pathEqual } from 'path-equal'
import validate, { Schema } from '../util/JsonValidator';
import { Binding } from "../types"
import { parseBindingsFile } from './bindings';
import Logger from '../util/logger';

const ROOT = path.parse(process.cwd()).root

const GLOBAL_PACKAGE_PATH = path.join(__dirname, '..', '..', 'global');

type PackageFile = {
    name: string,
    version: string,
    description: string,
    main: string,
    modules: {
        [key: string]: string
    }
}

type Package = {
    name: string,
    version: string,
    description: string,
    modules: {
        [key: string]: Module
    }
}

type Module = {
    object_file_path: string,
    bindings: Binding[]
}

const PackageSchema: Schema = {
    name: {
        type: 'string',
    },
    version: {
        type: 'string',
        default: '0.0.1'
    },
    description: {
        type: 'string',
        default: 'No description provided'
    },
    main: {
        type: 'string',
        default: 'main.ace'
    },
    modules: {
        type: 'object',
        required: true,
        values: {
            type: 'string'
        }
    }
}

function getFile(file_input: string) {
    const filePath = path.join('./', file_input);
    if(!fs.existsSync(filePath)) throw new Error(`File ${filePath} does not exist`);
    if(!fs.lstatSync(filePath).isFile()) return {
        workDir: filePath,
    }
    return {
        workDir: path.dirname(filePath),
        fileName: path.basename(filePath),
        file: filePath,
    }
}

export function initModuleManager(file_input: string, LOGGER: Logger) {

    const { workDir, fileName, file } = getFile(file_input);

    // load global package
    if(!fs.existsSync(GLOBAL_PACKAGE_PATH)) fs.mkdirSync(GLOBAL_PACKAGE_PATH);
    // locate global package
    const global_package_file_path = path.join(GLOBAL_PACKAGE_PATH, 'package.ace.json');

    // read global package
    let global_package_content;
    if(!fs.existsSync(global_package_file_path)) {
        global_package_content = JSON.stringify({
            name: 'global',
            version: '0.0.1',
            description: 'Global package',
            modules: {}
        }, null, 4)
        fs.writeFileSync(path.join(GLOBAL_PACKAGE_PATH, 'package.ace.json'), global_package_content)
    }
    else global_package_content = fs.readFileSync(global_package_file_path, 'utf-8');
    const global_package: PackageFile = JSON.parse(global_package_content);

    // validate global package
    PackageSchema.name.default = path.basename(workDir)
    const global_errors = validate(global_package, PackageSchema)
    if(global_errors.length) throw new Error(`Found ${global_errors.length} errors in global package.ace.json: \n${global_errors.join('\n\n')}`)

    // load global modules
    const global_modules = loadModules(global_package, GLOBAL_PACKAGE_PATH, LOGGER);

    const globalPackage: Package = {
        name: global_package.name,
        version: global_package.version,
        description: global_package.description,
        modules: global_modules,
    }

    // local package

    // detect if script is located in a package
    const package_file_path = locatePackage(workDir);
    if(package_file_path) {
        const package_path = path.dirname(package_file_path)

        // read package.ace.json
        const packageContent = fs.readFileSync(package_file_path, 'utf-8');
        const _package: PackageFile = JSON.parse(packageContent);

        // validate
        PackageSchema.name.default = path.basename(package_path)
        const errors = validate(_package, PackageSchema)
        if(errors.length) throw new Error(`Found ${errors.length} errors in package.ace.json: \n${errors.join('\n\n')}`)

        // load modules
        const modules = loadModules(_package, package_path, LOGGER);

        const localPackage: Package = {
            name: _package.name,
            version: _package.version,
            description: _package.description,
            modules,
        }

        return {
            workDir,
            fileName: fileName || _package.main,
            file: file || path.join(package_path, _package.main),
            moduleManager: new ModuleManager(globalPackage, localPackage)
        }
    }

    return {
        workDir,
        fileName: fileName || global_package.main,
        file: file || path.join(workDir, global_package.main),
        moduleManager: new ModuleManager(globalPackage)
    }
}

function loadModules(_package: PackageFile, package_path: string, LOGGER: Logger) {
    const modules: Package['modules'] = {};
    for(const key of Object.keys(_package.modules)) {
        const modulePath = path.join(package_path, _package.modules[key]);
        const objFilePath = path.join(modulePath, `${key}.o`);
        const bindingsFilePath = path.join(modulePath, `ace.bindings`);

        if(!fs.existsSync(objFilePath)) {
            LOGGER.warn(`Could not find object file for module ${key} at ${objFilePath}.`);
            continue
        }
        if(!fs.existsSync(bindingsFilePath)) {
            LOGGER.warn(`Could not find bindings file for module ${key} at ${bindingsFilePath}.`);
            continue
        }

        modules[key] = {
            object_file_path: objFilePath,
            bindings: parseBindingsFile(bindingsFilePath)
        }
    }
    return modules;
}

export class ModuleManager {

    private globalPackage: Package;
    private _package?: Package;

    private used_modules: string[] = []

    constructor(globalPackage: Package, _package?: Package) {
        this.globalPackage = globalPackage;
        this._package = _package;
    }

    get name() {
        if(!this._package) return this.globalPackage.name;
        return this._package.name;
    }

    get version() {
        if(!this._package) return this.globalPackage.version;
        return this._package.version;
    }

    get description() {
        if(!this._package) return this.globalPackage.description;
        return this._package.description;
    }

    public getModule(module_name: string) {
        if(!this._package) return this.globalPackage.modules[module_name];
        return this._package.modules[module_name];
    }

    public useModule(module_name: string) {
        if(this.used_modules.includes(module_name)) return
        this.used_modules.push(module_name);
    }

    public getLinkedFiles() {
        return this.used_modules.map(module_name => {
            if(!this._package) return this.globalPackage.modules[module_name].object_file_path;
            return this._package.modules[module_name].object_file_path;
        });
    }
}

function locatePackage(current_path: string): string | undefined {
    const package_path = path.join(current_path, 'package.ace.json');
    if(!fs.existsSync(package_path)) {
        // go up one directory
        const parent_path = path.resolve(path.join(current_path, '..'));
        // if we are at the root, throw an error
        if(pathEqual(parent_path, ROOT)) return undefined
        // otherwise, try again
        return locatePackage(parent_path);
    }
    return path.resolve(package_path)
}