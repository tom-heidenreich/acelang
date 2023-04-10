import * as fs from 'fs';
import path from 'path';
import { pathEqual } from 'path-equal'
import validate from '../util/JsonValidator';
import { Binding } from "../types"
import { parseBindingsFile } from './bindings';

const ROOT = path.parse(process.cwd()).root

type PackageFile = {
    name: string,
    version: string,
    description: string,
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

export function initModuleManager(work_dir: string) {
    // detect if script is located in a package
    const package_file_path = locatePackage(work_dir);
    if(!package_file_path) throw new Error('Could not locate package.ace.json');
    const package_path = path.dirname(package_file_path)

    // read package.ace.json
    const packageContent = fs.readFileSync(package_file_path, 'utf-8');
    const _package: PackageFile = JSON.parse(packageContent);

    // validate
    const errors = validate(_package, {
        name: {
            type: 'string',
            default: path.basename(package_path)
        },
        version: {
            type: 'string',
            default: '0.0.1'
        },
        description: {
            type: 'string',
            default: 'No description provided'
        },
        modules: {
            type: 'object',
            required: true,
            values: {
                type: 'string'
            }
        }
    })
    if(errors.length) throw new Error(`Found ${errors.length} errors in package.ace.json: \n${errors.join('\n\n')}`)

    // load modules
    const modules: Package['modules'] = {};
    for(const key of Object.keys(_package.modules)) {
        const modulePath = path.join(package_path, _package.modules[key]);
        const objFilePath = path.join(modulePath, `${key}.o`);
        const bindingsFilePath = path.join(modulePath, `ace.bindings`);

        if(!fs.existsSync(objFilePath)) throw new Error(`Could not find object file for module ${key} at ${objFilePath}`);
        if(!fs.existsSync(bindingsFilePath)) throw new Error(`Could not find bindings file for module ${key} at ${bindingsFilePath}`);

        modules[key] = {
            object_file_path: objFilePath,
            bindings: parseBindingsFile(bindingsFilePath)
        }
    }

    return new ModuleManager({
        name: _package.name,
        version: _package.version,
        description: _package.description,
        modules
    });
}

export class ModuleManager {

    private _package: Package;

    private used_modules: string[] = []

    constructor(_package: Package) {
        this._package = _package;
    }

    get name() {
        return this._package.name;
    }

    get version() {
        return this._package.version;
    }

    get description() {
        return this._package.description;
    }

    public getModule(module_name: string) {
        return this._package.modules[module_name];
    }

    public useModule(module_name: string) {
        this.used_modules.push(module_name);
    }

    public getLinkedFiles() {
        return this.used_modules.map(module_name => this._package.modules[module_name].object_file_path);
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