import { rmSync } from "fs";
import tsconfig from "../tsconfig.json";
import { exec } from "child_process";

function clearBuilderDirs() {
	console.log("Clearing out dirs.")
	const paths = [tsconfig.compilerOptions.outDir, tsconfig.compilerOptions.declarationDir];
	paths.forEach(path => rmSync(path, { recursive: true, force: true }));
	console.log("Cleared out dirs.")
}

function compile(): void {
	console.log("Start compile");
	const proc = exec("npx tsc", (err, out, _err) => {
		if (out) console.log(out);
		if (err) console.error(err);
		if (_err) console.error(_err);
	});
	proc.on('exit', code => code == 0 ? console.log("Compiled") : console.error(`Exit with code: ${code}`));
}


(() => {
	clearBuilderDirs();
	compile();
})()
