import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const sourceDir = resolve(root, 'docs/diagrams/src');
const svgDir = resolve(root, 'docs/diagrams/svg');
const pngDir = resolve(root, 'docs/diagrams/png');
const jarCandidates = [
  process.env.PLANTUML_JAR,
  resolve(root, 'tools/.cache/plantuml.jar'),
].filter((value): value is string => Boolean(value));

const requiredSources = [
  '01-system-context.puml',
  '02-container-architecture.puml',
  '03-vercel-firebase-deployment.puml',
  '04-role-rbac.puml',
  '05-clearance-workflow.puml',
  '06-auth-session-sequence.puml',
  '07-firestore-data-model.puml',
  '08-reporting-data-flow.puml',
];

function fail(message: string): never {
  console.error(`docs:diagrams failed: ${message}`);
  process.exit(1);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function locatePlantUml(): { command: string; prefix: string[] } {
  const jar = jarCandidates.find((candidate) => existsSync(candidate));
  if (jar) return { command: 'java', prefix: ['-jar', jar] };

  const where = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['plantuml'], {
    encoding: 'utf8',
  });
  const executable = where.status === 0 ? where.stdout.trim().split(/\r?\n/)[0] : '';
  if (executable) return { command: executable, prefix: [] };

  fail('PlantUML was not found. Install plantuml or set PLANTUML_JAR to the official JAR.');
}

if (!existsSync(sourceDir)) fail(`missing source directory ${sourceDir}`);
mkdirSync(svgDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

const missing = requiredSources.filter((name) => !existsSync(join(sourceDir, name)));
if (missing.length > 0) fail(`missing required sources: ${missing.join(', ')}`);

const renderer = locatePlantUml();
const sources = requiredSources.map((name) => join(sourceDir, name));

// PlantUML's -checkonly validates all sources without writing render output.
run(renderer.command, [...renderer.prefix, '-checkonly', ...sources]);

for (const source of sources) {
  run(renderer.command, [...renderer.prefix, '-tsvg', '-o', svgDir, source]);
  run(renderer.command, [...renderer.prefix, '-tpng', '-o', pngDir, source]);
}

const missingSvg = requiredSources.filter((name) => !existsSync(join(svgDir, name.replace(/\.puml$/, '.svg'))));
const missingPng = requiredSources.filter((name) => !existsSync(join(pngDir, name.replace(/\.puml$/, '.png'))));
if (missingSvg.length || missingPng.length) {
  fail(`render outputs missing; SVG: ${missingSvg.join(', ') || 'none'}; PNG: ${missingPng.join(', ') || 'none'}`);
}

const generatedSvg = readdirSync(svgDir).filter((name) => name.endsWith('.svg')).length;
const generatedPng = readdirSync(pngDir).filter((name) => name.endsWith('.png')).length;
console.log(`PlantUML diagrams rendered successfully: ${generatedSvg} SVG, ${generatedPng} PNG.`);
