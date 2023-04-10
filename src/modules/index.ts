import * as fs from 'fs';
import path from 'path';
import { pathEqual } from 'path-equal'
import validate from '../util/JsonValidator';

const ROOT = path.parse(process.cwd()).root

type Package = {
    name: string,
    version: string,
    description: string,
    modules: {
        [key: string]: string
    }
}

export function initModuleManager(work_dir: string) {
    // detect if script is located in a package
    const package_path  = locatePackage(work_dir);
    if(!package_path) throw new Error('Could not locate package.ace.json');

    // read package.ace.json
    const packageContent = fs.readFileSync(package_path, 'utf-8');
    const _package: Package = JSON.parse(packageContent);

    // validate
    const errors = validate(_package, {
        name: {
            type: 'string',
            default: path.basename(path.dirname(package_path))
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

    return new ModuleManager(_package);
}

export class ModuleManager {

    private _package: Package;

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

    public isInstalled(module_name: string) {
        return !!this._package.modules[module_name];
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
    return package_path
}