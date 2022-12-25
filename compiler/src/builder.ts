import { Build, Functions, Instructions } from "./types";
import * as fs from "fs";

const templates: { [key: string]: string } = {};

export function loadTemplates() {
    const templateDir = "./templates";
    const files = fs.readdirSync(templateDir);
    files.forEach((file) => {
        const content = fs.readFileSync(`${templateDir}/${file}`, "utf8");
        templates[file] = content;
    })
}

export function createBuild(build: Build) {

    let template = templates['main.c'];

    // build functions
    const functions = buildFunctions(build.functions);
    template = template.replace("{{functions}}", functions);

    // main
    const main = buildInstructions(build.main);
    template = template.replace("{{main}}", main);

    return template;
}

function buildInstructions(instructions: Instructions): string {
    for(const instruction of instructions.run) {
        if(instruction.type === "return") {
            return `return ${instruction.value};`;
        }
    }
    return "";
}

function buildFunctions(functions: Functions) {

    let output = "";

    const functionNames = Object.keys(functions);
    for(const name of functionNames) {

        let template = templates['func.c'];

        const func = functions[name];

        // params
        // TODO: expand param support
        const param = func.params[0];
        if(param) {
            template = template.replace("{{arg}}", param.name);
            template = template.replace("{{argType}}", param.type);
        }
        else {
            template = templates['func_no_arg.c']
        }

        // name
        template = template.replace("{{name}}", name);


        // return type
        template = template.replace("{{returnType}}", func.returnType);

        // body
        template = template.replace("{{body}}", buildInstructions(func.body));

        output += template + "\n\n";
    }

    return output;
}